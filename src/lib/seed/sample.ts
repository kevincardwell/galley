import "server-only";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db, schema } from "@/db/client";
import { newId } from "@/lib/ids";
import { slugify } from "@/lib/slug";
import { storage } from "@/lib/storage";
import { enqueueAsset } from "@/lib/media/process";
import { tiptapToText, wordCount, type TiptapDoc, type TiptapNode } from "@/lib/copy/serialize";
import type { SectionStatus, TaskStatus } from "@/db/schema";

/**
 * "Marlow & Finch Joinery": a filled-in workspace so a fresh install has something to look at.
 * Files are written first (sharp renders four warm placeholder images), then every row goes in
 * inside one transaction, then the images are queued for thumbnails and palettes.
 */

const WORKSPACE = { name: "Marlow & Finch Joinery", clientName: "Tom Marlow", url: "https://marlowandfinch.co.uk", accent: "#2F6B4F" } as const;

// ---------------------------------------------------------------- tiptap helpers

const text = (t: string, marks?: { type: string }[]): TiptapNode => (marks ? { type: "text", text: t, marks } : { type: "text", text: t });
const h = (level: 1 | 2 | 3, t: string): TiptapNode => ({ type: "heading", attrs: { level }, content: [text(t)] });
const p = (...parts: (string | TiptapNode)[]): TiptapNode => ({ type: "paragraph", content: parts.map((x) => (typeof x === "string" ? text(x) : x)) });
const bullets = (...items: string[]): TiptapNode => ({
  type: "bulletList",
  content: items.map((t) => ({ type: "listItem", content: [p(t)] })),
});
const doc = (...content: TiptapNode[]): TiptapDoc => ({ type: "doc", content });

// ---------------------------------------------------------------- content

type SeedSection = { title: string; status: SectionStatus; content: TiptapDoc };
type SeedPage = { title: string; slug: string; sections: SeedSection[] };

const PAGES: SeedPage[] = [
  {
    title: "Home",
    slug: "home",
    sections: [
      {
        title: "Hero",
        status: "approved",
        content: doc(
          h(1, "Furniture made to last a lifetime, built in a small workshop in Suffolk"),
          p("We design and make bespoke joinery for houses that deserve better than flat-pack: kitchens, staircases, fitted wardrobes and the occasional dining table that becomes the family heirloom."),
        ),
      },
      {
        title: "What we make",
        status: "review",
        content: doc(
          h(2, "What we make"),
          p("Every piece starts with a conversation and a tape measure. Once we know how you live, we draw, you approve, and we build it in oak, ash, walnut or whatever timber suits the room."),
          bullets("Fitted kitchens and pantries", "Staircases, balustrades and handrails", "Wardrobes, alcove units and libraries", "Freestanding tables, benches and desks"),
        ),
      },
      {
        title: "Why a small workshop",
        status: "draft",
        content: doc(
          h(2, "Why a small workshop"),
          p("There are four of us. That means the person who measures your kitchen is the person who cuts the joints and the person who fits it. Nothing gets lost between departments, because there are no departments."),
        ),
      },
      {
        title: "Call to action",
        status: "approved",
        content: doc(h(2, "Start with a sketch"), p("Send us a photo of the room and a rough idea of what you are after. We will come back within two working days with first thoughts and a ballpark figure.")),
      },
    ],
  },
  {
    title: "About",
    slug: "about",
    sections: [
      {
        title: "Our story",
        status: "approved",
        content: doc(
          h(1, "Two names, one bench"),
          p("Tom Marlow served his time with a boatbuilder on the Deben before setting up on his own in 2009. Ellie Finch joined three years later, bringing a background in furniture design from Rycotewood. The name went on the door in 2014 and has stayed there since."),
          p("We still work from the same converted grain store outside Woodbridge, now with a proper spray room and a machine shop that no longer floods."),
        ),
      },
      {
        title: "How we work",
        status: "review",
        content: doc(
          h(2, "How we work"),
          p("Measured survey, scaled drawings, a sample of the finish, then the build. You see the piece dry-assembled in the workshop before it is finished, so there are no surprises on fitting day."),
        ),
      },
      {
        title: "Timber and finishes",
        status: "draft",
        content: doc(
          h(2, "Timber and finishes"),
          p("We buy English oak and ash from a sawmill near Bury St Edmunds and air-dry it ourselves for at least a year before it goes anywhere near a machine. Finishes are hardwax oil as standard, with sprayed lacquer or painted MDF where the job calls for it."),
        ),
      },
    ],
  },
  {
    title: "Workshop",
    slug: "workshop",
    sections: [
      {
        title: "Intro",
        status: "review",
        content: doc(
          h(1, "The workshop"),
          p("Eighteen hundred square feet of bench space, a Felder saw that has never once been blamed for a mistake, and a kettle that runs from seven in the morning."),
        ),
      },
      {
        title: "Visiting",
        status: "draft",
        content: doc(
          h(2, "Come and see"),
          p("Clients are welcome any weekday. Ring first so we can find you a stool and make sure the spray room is not mid-coat. We are twenty minutes from Ipswich and a short walk from Melton station."),
        ),
      },
      {
        title: "Recent work",
        status: "approved",
        content: doc(
          h(2, "Recently off the bench"),
          bullets("A curved oak staircase for a barn conversion in Framlingham", "A twelve-seat walnut dining table with a bookmatched top", "A run of painted alcove cupboards in a Georgian townhouse in Bury"),
        ),
      },
    ],
  },
  {
    title: "Contact",
    slug: "contact",
    sections: [
      {
        title: "Get in touch",
        status: "approved",
        content: doc(
          h(1, "Get in touch"),
          p("Email is best during the day because we are usually holding something heavy. Ring in the evening and you will get Tom."),
          p("hello@marlowandfinch.co.uk · 01394 000 000"),
        ),
      },
      {
        title: "Find us",
        status: "review",
        content: doc(h(2, "Find us"), p("The Grain Store, Bredfield Road, Woodbridge, Suffolk IP12 4QT. Turn in past the white gate; parking is by the timber stack.")),
      },
    ],
  },
];

type SeedTask = {
  section: string;
  title: string;
  body?: string;
  status: TaskStatus;
  due?: number; // days from today
  assign?: boolean;
  checklist?: string[];
  attach?: boolean;
};

const TASKS: SeedTask[] = [
  { section: "Design", title: "Agree the colour palette with Tom", status: "done", due: -12, assign: true },
  { section: "Design", title: "Homepage wireframe", body: "Hero, three services, recent work strip, contact block. Keep it to one scroll on mobile.", status: "done", due: -6 },
  { section: "Design", title: "Pick the display typeface", body: "Tom likes something with a bit of character but not a slab. Try Fraunces and Newsreader side by side.", status: "doing", due: 2, assign: true },
  { section: "Build", title: "Set up the staging site", status: "done", due: -3 },
  {
    section: "Build",
    title: "Build the Workshop gallery",
    body: "Masonry grid of workshop photos with a lightbox. Needs to cope with portrait and landscape shots without cropping the joinery detail.",
    status: "todo",
    due: 5,
    assign: true,
    checklist: ["Export photos at 1600px", "Lazy-load below the fold", "Test on a slow connection", "Check alt text with Tom"],
    attach: true,
  },
  { section: "Build", title: "Contact form to hello@ with a spam check", status: "todo", due: 8 },
  { section: "Content", title: "Write the About page", body: "Tom's boatbuilding years are the hook. Two short paragraphs, no CV.", status: "doing", assign: true, due: 1 },
  { section: "Content", title: "Photograph the walnut table before it leaves", status: "todo", due: -1 },
  { section: "Launch", title: "Point marlowandfinch.co.uk at the new host", status: "todo", due: 21 },
  { section: "Launch", title: "Ask Tom for two client testimonials", status: "todo" },
];

const SECTIONS = ["Design", "Build", "Content", "Launch"];

// ---------------------------------------------------------------- images

type SeedImage = { filename: string; width: number; height: number; tags: string[]; svg: (w: number, h: number) => string };

const wood = (id: string, from: string, to: string, angle = 30) =>
  `<linearGradient id="${id}" gradientTransform="rotate(${angle})"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`;

const IMAGES: SeedImage[] = [
  {
    filename: "workshop-bench.jpg",
    width: 1600,
    height: 1000,
    tags: ["workshop", "hero"],
    svg: (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs>${wood("g", "#8a5a34", "#c9975b")}</defs>
      <rect width="${w}" height="${h}" fill="url(#g)"/>
      <rect x="${w * 0.1}" y="${h * 0.62}" width="${w * 0.8}" height="${h * 0.08}" rx="8" fill="#4d2f18" opacity="0.85"/>
      <rect x="${w * 0.14}" y="${h * 0.7}" width="${w * 0.05}" height="${h * 0.22}" fill="#4d2f18" opacity="0.85"/>
      <rect x="${w * 0.81}" y="${h * 0.7}" width="${w * 0.05}" height="${h * 0.22}" fill="#4d2f18" opacity="0.85"/>
      <circle cx="${w * 0.72}" cy="${h * 0.3}" r="${h * 0.16}" fill="#f2d7a7" opacity="0.5"/></svg>`,
  },
  {
    filename: "oak-dining-table.jpg",
    width: 1200,
    height: 1600,
    tags: ["furniture", "oak"],
    svg: (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs>${wood("g", "#b98a5a", "#e6c79a", 80)}</defs>
      <rect width="${w}" height="${h}" fill="url(#g)"/>
      <ellipse cx="${w / 2}" cy="${h * 0.55}" rx="${w * 0.4}" ry="${h * 0.14}" fill="#6b4324" opacity="0.8"/>
      <rect x="${w * 0.3}" y="${h * 0.62}" width="${w * 0.04}" height="${h * 0.24}" fill="#4d2f18"/>
      <rect x="${w * 0.66}" y="${h * 0.62}" width="${w * 0.04}" height="${h * 0.24}" fill="#4d2f18"/></svg>`,
  },
  {
    filename: "timber-stack.jpg",
    width: 1600,
    height: 900,
    tags: ["workshop", "timber"],
    svg: (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs>${wood("g", "#6f4526", "#a87646", 0)}</defs>
      <rect width="${w}" height="${h}" fill="url(#g)"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${w * 0.08}" y="${h * (0.2 + i * 0.12)}" width="${w * 0.84}" height="${h * 0.08}" rx="6" fill="#d9ad72" opacity="${0.35 + i * 0.1}"/>`).join("")}
      </svg>`,
  },
  {
    filename: "dovetail-detail.jpg",
    width: 1000,
    height: 1000,
    tags: ["detail", "oak"],
    svg: (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs>${wood("g", "#c48b52", "#f0d3a2", 45)}</defs>
      <rect width="${w}" height="${h}" fill="url(#g)"/>
      ${[0, 1, 2, 3].map((i) => `<polygon points="${w * 0.5},${h * (0.14 + i * 0.2)} ${w * 0.68},${h * (0.1 + i * 0.2)} ${w * 0.68},${h * (0.26 + i * 0.2)}" fill="#7a4a24" opacity="0.8"/>`).join("")}
      <rect x="${w * 0.5}" y="0" width="4" height="${h}" fill="#4d2f18" opacity="0.4"/></svg>`,
  },
];

async function renderImage(img: SeedImage): Promise<Buffer> {
  return sharp(Buffer.from(img.svg(img.width, img.height))).jpeg({ quality: 82 }).toBuffer();
}

// ---------------------------------------------------------------- helpers

function uniqueSlug(base: string) {
  const root = slugify(base);
  let slug = root;
  for (let i = 2; ; i++) {
    const hit = db.select({ id: schema.workspaces.id }).from(schema.workspaces).where(eq(schema.workspaces.slug, slug)).get();
    if (!hit) return slug;
    slug = `${root}-${i}`;
  }
}

function isoDaysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const nowS = () => Math.floor(Date.now() / 1000);

// ---------------------------------------------------------------- main

type SampleSupplier = {
  name: string; category: string; contactName: string; email: string; phone: string; website: string; notes: string;
  rating: number; tags: string[]; status: "shortlisted" | "enquired" | "booked" | "declined"; cost: number | null; note: string;
};

/** A small, believable address book so the directory is not empty on a fresh install. */
const SAMPLE_SUPPLIERS: SampleSupplier[] = [
  { name: "Thames Print & Bind", category: "Printer", contactName: "Ruth Ellery", email: "hello@thamesprint.co.uk", phone: "01628 447 210", website: "https://thamesprint.co.uk", notes: "Litho and digital. Two-day turnaround on uncoated stock. Ask for Ruth for anything over 500 copies.", rating: 5, tags: ["print", "local"], status: "booked", cost: 48000, note: "Brochure and business cards, 500 each." },
  { name: "Alder & Frame Photography", category: "Photographer", contactName: "Niamh Alder", email: "studio@alderframe.co.uk", phone: "07812 664 031", website: "https://alderframe.co.uk", notes: "Interiors and maker portraits. Brings her own lighting. Half day is plenty for a workshop shoot.", rating: 5, tags: ["photography", "interiors"], status: "booked", cost: 65000, note: "Half day at the workshop, includes 40 edited images." },
  { name: "Ridgeway Copywriting", category: "Copywriter", contactName: "Sam Okafor", email: "sam@ridgewaycopy.co.uk", phone: "07440 118 902", website: "https://ridgewaycopy.co.uk", notes: "Good on trade and craft businesses. Works from a brief and a transcript.", rating: 4, tags: ["copy"], status: "enquired", cost: 32000, note: "Quote for Home and About pages." },
  { name: "Beacon Hosting", category: "Hosting", contactName: "Support desk", email: "support@beaconhosting.uk", phone: "0330 221 4480", website: "https://beaconhosting.uk", notes: "UK data centre, daily backups included. Migration help is free on business plans.", rating: 4, tags: ["hosting", "infrastructure"], status: "shortlisted", cost: 18000, note: "Business plan, billed yearly." },
  { name: "Quill Signwriting", category: "Signwriter", contactName: "Peter Quill", email: "peter@quillsigns.co.uk", phone: "01494 772 118", website: "https://quillsigns.co.uk", notes: "Hand-painted fascia work. Long lead time in summer.", rating: 3, tags: ["signage"], status: "declined", cost: null, note: "Out of scope for this phase." },
];

type SampleScheduleItem = {
  title: string; inDays: number; hour?: number; minute?: number; endHour?: number; endMinute?: number;
  allDay?: boolean; location?: string; notes?: string;
};

/** A launch-week run sheet: the kind of thing a project lead keeps on a wall. */
const SAMPLE_SCHEDULE: SampleScheduleItem[] = [
  { title: "Photography at the workshop", inDays: 2, hour: 9, endHour: 13, location: "Marlow workshop", notes: "Niamh arrives 08:45. Clear the bench by the window." },
  { title: "Copy review with Tom", inDays: 3, hour: 15, minute: 30, endHour: 16, endMinute: 30, location: "Video call" },
  { title: "Print artwork deadline", inDays: 5, allDay: true, notes: "Files to Thames Print by end of day." },
  { title: "Staging walkthrough", inDays: 8, hour: 11, endHour: 12, location: "Video call" },
  { title: "Go live", inDays: 12, allDay: true, notes: "DNS change in the morning, watch the forms all afternoon." },
];

export async function createSampleWorkspace(ownerId: string): Promise<{ workspaceId: string; slug: string }> {
  const workspaceId = newId();
  const slug = uniqueSlug(WORKSPACE.name);

  // 1. Files first, outside the transaction.
  const files: { id: string; img: SeedImage; bytes: number }[] = [];
  try {
    for (const img of IMAGES) {
      const id = newId();
      const buf = await renderImage(img);
      await storage.writeOriginal(workspaceId, id, ".jpg", Readable.from(buf));
      files.push({ id, img, bytes: buf.length });
    }
  } catch (err) {
    await storage.removeWorkspace(workspaceId).catch(() => {});
    throw err;
  }

  // 2. Every row in one transaction.
  const now = nowS();
  db.transaction((tx) => {
    tx.insert(schema.workspaces)
      .values({ id: workspaceId, name: WORKSPACE.name, slug, url: WORKSPACE.url, clientName: WORKSPACE.clientName, accent: WORKSPACE.accent, status: "building", createdBy: ownerId })
      .run();
    tx.insert(schema.memberships).values({ workspaceId, userId: ownerId, role: "manager", addedBy: ownerId }).run();

    const sectionIds = new Map<string, string>();
    SECTIONS.forEach((name, i) => {
      const id = newId();
      sectionIds.set(name, id);
      tx.insert(schema.taskSections).values({ id, workspaceId, name, position: i }).run();
    });

    const positions = new Map<string, number>();
    let attachTaskId: string | null = null;
    let attachTaskTitle = "";
    for (const t of TASKS) {
      const sectionId = sectionIds.get(t.section)!;
      const position = positions.get(sectionId) ?? 0;
      positions.set(sectionId, position + 1);
      const id = newId();
      const done = t.status === "done";
      tx.insert(schema.tasks)
        .values({
          id,
          workspaceId,
          sectionId,
          title: t.title,
          body: t.body ?? "",
          status: t.status,
          assigneeId: t.assign ? ownerId : null,
          dueOn: t.due === undefined ? null : isoDaysFromNow(t.due),
          position,
          createdBy: ownerId,
          createdAt: now - 60 * 60 * 24 * 14,
          completedAt: done ? now - 60 * 60 * 24 * 2 : null,
        })
        .run();
      t.checklist?.forEach((textItem, i) => {
        tx.insert(schema.taskChecklist).values({ id: newId(), taskId: id, text: textItem, done: i === 0, position: i }).run();
      });
      if (t.attach) {
        attachTaskId = id;
        attachTaskTitle = t.title;
      }
    }

    let heroSectionId: string | null = null;
    PAGES.forEach((page, pi) => {
      const pageId = newId();
      tx.insert(schema.pages).values({ id: pageId, workspaceId, title: page.title, slug: page.slug, position: pi }).run();
      page.sections.forEach((s, si) => {
        const id = newId();
        const plainText = tiptapToText(s.content);
        tx.insert(schema.sections)
          .values({
            id,
            pageId,
            workspaceId,
            title: s.title,
            content: s.content,
            plainText,
            wordCount: wordCount(plainText),
            status: s.status,
            position: si,
            updatedBy: ownerId,
            clientApprovedAt: s.status === "approved" ? now - 60 * 60 * 24 * 3 : null,
            clientApprovedBy: s.status === "approved" ? WORKSPACE.clientName : null,
          })
          .run();
        if (page.slug === "home" && si === 0) heroSectionId = id;
      });
    });

    for (const f of files) {
      tx.insert(schema.assets)
        .values({ id: f.id, workspaceId, kind: "image", filename: f.img.filename, mime: "image/jpeg", bytes: f.bytes, width: f.img.width, height: f.img.height, uploadedBy: ownerId })
        .run();
      for (const tag of f.img.tags) tx.insert(schema.assetTags).values({ assetId: f.id, tag }).run();
    }
    const [bench, , , dovetail] = files;
    if (bench && heroSectionId) tx.insert(schema.attachments).values({ id: newId(), assetId: bench.id, sectionId: heroSectionId }).run();
    if (dovetail && attachTaskId) tx.insert(schema.attachments).values({ id: newId(), assetId: dovetail.id, taskId: attachTaskId }).run();

    const log = (verb: string, subjectType: string, subjectId: string | null, subjectTitle: string, ago: number, meta?: unknown) =>
      tx.insert(schema.activity).values({ workspaceId, actorId: ownerId, verb, subjectType, subjectId, subjectTitle, meta: meta ?? null, createdAt: now - ago }).run();
    log("created", "workspace", workspaceId, WORKSPACE.name, 60 * 60 * 24 * 14);
    for (const f of files) log("uploaded", "asset", f.id, f.img.filename, 60 * 60 * 24 * 9, { kind: "image", bytes: f.bytes });
    log("completed", "task", null, "Homepage wireframe", 60 * 60 * 24 * 2);
    log("approved", "section", heroSectionId, "Hero", 60 * 60 * 24 * 3);
    if (attachTaskId) log("updated", "task", attachTaskId, attachTaskTitle, 60 * 60 * 5);

    // Suppliers the studio actually uses, and the run sheet for launch week.
    for (const sup of SAMPLE_SUPPLIERS) {
      const supplierId = newId();
      tx.insert(schema.suppliers)
        .values({ id: supplierId, name: sup.name, category: sup.category, contactName: sup.contactName, email: sup.email, phone: sup.phone, website: sup.website, notes: sup.notes, rating: sup.rating, createdBy: ownerId })
        .run();
      for (const tag of sup.tags) tx.insert(schema.supplierTags).values({ supplierId, tag }).run();
      tx.insert(schema.workspaceSuppliers)
        .values({ id: newId(), workspaceId, supplierId, status: sup.status, cost: sup.cost, note: sup.note, createdBy: ownerId })
        .run();
    }

    const nine = (offsetDays: number, hour: number, minute = 0) => {
      const d = new Date();
      d.setDate(d.getDate() + offsetDays);
      d.setHours(hour, minute, 0, 0);
      return Math.floor(d.getTime() / 1000);
    };
    for (const item of SAMPLE_SCHEDULE) {
      tx.insert(schema.scheduleItems)
        .values({
          id: newId(),
          workspaceId,
          title: item.title,
          notes: item.notes ?? null,
          startsAt: item.allDay ? nine(item.inDays, 0) : nine(item.inDays, item.hour ?? 9, item.minute ?? 0),
          endsAt: item.allDay ? null : nine(item.inDays, item.endHour ?? (item.hour ?? 9) + 1, item.endMinute ?? 0),
          allDay: item.allDay ?? false,
          location: item.location ?? null,
          ownerId,
          createdBy: ownerId,
        })
        .run();
    }
  });

  // 3. Thumbnails and palettes in the background.
  for (const f of files) enqueueAsset(f.id);

  return { workspaceId, slug };
}
