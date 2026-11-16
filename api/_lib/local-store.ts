import fs from 'fs';
import path from 'path';
import { defaultSettings } from './payment-shared';

const DATA_DIR = path.resolve(process.cwd(), '.data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile<T>(filename: string, fallback: T): T {
  try {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonFile<T>(filename: string, data: T): void {
  try {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`[Local Store] Could not write ${filename}:`, err);
  }
}

export function getLocalPaymentSettings() {
  return readJsonFile('payment-settings.json', defaultSettings());
}

export function saveLocalPaymentSettings(settings: any) {
  writeJsonFile('payment-settings.json', settings);
}

export function getLocalPayments(): any[] {
  return readJsonFile<any[]>('payments.json', []);
}

export function saveLocalPayments(payments: any[]) {
  writeJsonFile('payments.json', payments);
}

export function getLocalAccounts(): Record<string, any> {
  return readJsonFile<Record<string, any>>('payment-accounts.json', {});
}

export function saveLocalAccounts(accounts: Record<string, any>) {
  writeJsonFile('payment-accounts.json', accounts);
}
