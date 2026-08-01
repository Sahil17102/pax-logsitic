import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);

export async function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = await scrypt(String(password), salt, 64);
  return { salt, hash: Buffer.from(derived).toString("hex") };
}

export async function passwordMatches(password, record) {
  if (!record?.salt || !record?.passwordHash) return false;
  const candidate = await hashPassword(password, record.salt);
  const candidateBuffer = Buffer.from(candidate.hash, "hex");
  const storedBuffer = Buffer.from(record.passwordHash, "hex");
  return candidateBuffer.length === storedBuffer.length && crypto.timingSafeEqual(candidateBuffer, storedBuffer);
}
