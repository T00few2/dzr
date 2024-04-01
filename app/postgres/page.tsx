import { sql } from "@vercel/postgres";
import { Text } from '@chakra-ui/react';

export default async function test({ params }: { params: { user: string } }): Promise<JSX.Element> {

  const { rows } = await sql`SELECT * FROM public.test`;


  return (
    <div>
      {rows.map((row) => (
        <div key={row.brand}>
          <Text color = 'white'>{row.brand}</Text>
          <Text color = 'white'>{row.model}</Text>
        </div>
      ))}
    </div>
  );
}
