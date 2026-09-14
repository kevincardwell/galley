import { describe, expect, it } from "vitest";
import { digestEmail, inviteEmail, notificationEmail, testEmail } from "@/lib/email/templates";

const all = [
  inviteEmail({ instanceName: "Galley", url: "https://g.test/invite/abc", inviterName: "Kev", workspaceName: "Marlow", expiresDays: 7 }),
  notificationEmail({ instanceName: "Galley", title: "Tom commented", body: "Looks good", url: "https://g.test/w/x" }),
  testEmail({ instanceName: "Galley" }),
  digestEmail({ instanceName: "Galley", projectName: "Marlow", changes: ["Rewrote Hero"], waitingOn: ["Home › Hero"], shareUrl: "https://g.test/share/t" }),
];

describe("email templates", () => {
  it("always produce both a text and an HTML part", () => {
    for (const mail of all) {
      expect(mail.subject).toBeTruthy();
      expect(mail.text.trim()).toBeTruthy();
      expect(mail.html).toContain("<!doctype html>");
      expect(mail.html).toContain("</html>");
    }
  });

  it("keep the text part free of markup", () => {
    for (const mail of all) expect(mail.text).not.toMatch(/<[a-z]/i);
  });

  /**
   * Section titles, project names and guest names are all typed by people and
   * all end up in this HTML, which the admin preview then renders.
   */
  it("escape anything that came from a person", () => {
    const mail = digestEmail({
      instanceName: "Galley",
      projectName: '<script>alert(1)</script>',
      changes: ['Rewrote <img src=x onerror="alert(2)">'],
      waitingOn: ["Home › \"quoted\" & odd"],
      shareUrl: "https://g.test/share/t",
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("&amp;");
  });

  it("put a link in the digest and name the project in the subject", () => {
    const mail = digestEmail({ instanceName: "Galley", projectName: "Marlow", changes: [], waitingOn: ["A", "B"], shareUrl: "https://g.test/share/t" });
    expect(mail.subject).toBe("Marlow: 2 things to look at");
    expect(mail.html).toContain('href="https://g.test/share/t"');
    expect(mail.text).toContain("https://g.test/share/t");
  });

  it("say it plainly when only the client owes something", () => {
    const mail = digestEmail({ instanceName: "Galley", projectName: "Marlow", changes: [], waitingOn: ["Home › Hero"], shareUrl: "https://g.test/s" });
    expect(mail.subject).toBe("Marlow: 1 thing to look at");
    expect(mail.text).toContain("Nothing changed on our side");
  });

  it("leave out an empty list rather than printing an empty heading", () => {
    const mail = digestEmail({ instanceName: "Galley", projectName: "Marlow", changes: ["Rewrote Hero"], waitingOn: [], shareUrl: "https://g.test/s" });
    expect(mail.subject).toBe("Marlow: this week");
    expect(mail.html).not.toContain("Waiting on you");
    expect(mail.text).not.toContain("Waiting on you");
  });
});
