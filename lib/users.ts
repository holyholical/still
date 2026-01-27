import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

type User = {
  id: string;
  email: string;
  passwordHash: string;
};

type UsersFile = {
  [email: string]: User;
};

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_PATH = path.join(DATA_DIR, "users.json");

async function ensureUsersFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(USERS_PATH);
  } catch {
    const initial: UsersFile = {};
    await fs.writeFile(USERS_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readUsersFile(): Promise<UsersFile> {
  await ensureUsersFile();
  const raw = await fs.readFile(USERS_PATH, "utf8");
  try {
    return JSON.parse(raw) as UsersFile;
  } catch {
    return {};
  }
}

async function writeUsersFile(data: UsersFile) {
  await ensureUsersFile();
  await fs.writeFile(USERS_PATH, JSON.stringify(data, null, 2), "utf8");
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function authenticateOrCreateUser(params: {
  email: string;
  password: string;
}): Promise<User | null> {
  const email = params.email.trim().toLowerCase();
  const password = params.password;

  if (!email || !password) return null;

  const file = await readUsersFile();
  const existing = file[email];
  const passwordHash = hashPassword(password);

  if (!existing) {
    const id = `user_${encodeURIComponent(email)}`;
    const user: User = { id, email, passwordHash };
    file[email] = user;
    await writeUsersFile(file);
    return user;
  }

  if (existing.passwordHash !== passwordHash) {
    return null;
  }

  return existing;
}

