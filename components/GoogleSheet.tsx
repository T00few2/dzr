import React from "react";

interface GoogleSheetsEmbedProps {
  spreadsheetId: string;
}

const GoogleSheetsEmbed: React.FC<GoogleSheetsEmbedProps> = ({ spreadsheetId }) => {
  const url = `https://docs.google.com/spreadsheets/d/e/${spreadsheetId}/pubhtml?widget=true&amp;headers=false`;

  return (
    <div>
      <iframe
        title="Google Sheets Embed"
        src={url}
        width="100%"
        height="500"
        
      ></iframe>
    </div>
  );
};

export default GoogleSheetsEmbed;