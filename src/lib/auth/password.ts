import { hash, verify } from "@node-rs/argon2";

export const hashPassword = (plain: string) => hash(plain, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
export const verifyPassword = (hashed: string, plain: string) => verify(hashed, plain).catch(() => false);
