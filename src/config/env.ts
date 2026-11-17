import 'dotenv/config';

/**
 * Single source of truth for environment configuration.
 * Defaults point to the public Toolshop demo; override via .env or CI secrets.
 * The default customer account is a publicly documented demo account.
 */
export const env = {
  baseURL: process.env.BASE_URL || 'https://practicesoftwaretesting.com',
  apiURL: process.env.API_URL || 'https://api.practicesoftwaretesting.com',
  customer: {
    email: process.env.CUSTOMER_EMAIL || 'customer@practicesoftwaretesting.com',
    password: process.env.CUSTOMER_PASSWORD || 'welcome01',
  },
  // Seeded admin of Toolshop (database/seeders/UserSeeder.php); only used against our own instance (see Tag.admin).
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@practicesoftwaretesting.com',
    password: process.env.ADMIN_PASSWORD || 'welcome01',
  },
} as const;

/** The shared public demo: other people use it, so tests must not change its catalogue or orders there. */
export const isPublicDemo = env.baseURL.includes('practicesoftwaretesting.com');

export const STORAGE_STATE = 'playwright/.auth/customer.json';
