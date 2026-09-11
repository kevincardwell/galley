import { customAlphabet } from "nanoid";
export const newId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 16);
export const newToken = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", 40);
