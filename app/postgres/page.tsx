import { sql } from "@vercel/postgres";
import { Text, Button } from '@chakra-ui/react';

import {data} from "../data/data";

export default async function MyComponent() {
  const dataNow = await data
  const rows = dataNow.rows
  return (
        <div > 
          {rows.map((row) => (
            <div key = {row.brand}>
          <Text color="white">{row.brand}</Text>
          </div>
          ))}
        </div>
    
)}

