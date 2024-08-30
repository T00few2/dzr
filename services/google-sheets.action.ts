'use server';
import { google } from "googleapis";

export async function getSheetData() { 
  const glAuth = await google.auth.getClient({
        projectId: process.env.GOOGLE_project_id,
        credentials: {
                "type": "service_account",
                "project_id": process.env.GOOGLE_project_id,
                "private_key_id": process.env.GOOGLE_private_key_id,
                "private_key": process.env.GOOGLE_private_key,
                "client_email": process.env.GOOGLE_client_email,
                "client_id": process.env.GOOGLE_client_id,
                "universe_domain": "googleapis.com",
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const glSheets = google.sheets({ version: "v4", auth: glAuth });

    const APSdata = await glSheets.spreadsheets.values.get({
        spreadsheetId: "1lut3HrhO45Lz__-yNgjQMk5crU_eIN7nzc1pzcx2uoQ",
        range: 'After Party Series!A1:C100',
    });

    const ZFdata = await glSheets.spreadsheets.values.get({
        spreadsheetId: "1lut3HrhO45Lz__-yNgjQMk5crU_eIN7nzc1pzcx2uoQ",
        range: 'Zwifty Fifty!A1:C100',
    });
        
    return { APSdata: APSdata.data.values, ZFdata: ZFdata.data.values };
}