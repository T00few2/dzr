import { sql } from "@vercel/postgres";

export const data =  sql`SELECT * FROM public.test`;