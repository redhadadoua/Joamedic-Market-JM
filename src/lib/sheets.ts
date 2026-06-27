import { getAccessToken } from "./firebase";

export async function createSpreadsheet(title: string = "JOAmedic Orders"): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("No Google access token available");

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title
      },
      sheets: [
        {
          properties: {
            title: "Orders"
          }
        }
      ]
    })
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(`Failed to create spreadsheet: ${JSON.stringify(errorData)}`);
  }

  const data = await res.json();
  
  // Set header row
  await appendRowToSheet(data.spreadsheetId, [
    "Order ID", "Date", "Customer Name", "Phone", "Address", "Delivery Method", "Color", "Size", "Status"
  ]);

  return data.spreadsheetId;
}

export async function appendRowToSheet(spreadsheetId: string, values: string[]) {
  const token = await getAccessToken();
  if (!token) throw new Error("No Google access token available");

  const range = 'Orders!A:I'; // Assuming we have 9 columns
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [values]
    })
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(`Failed to append row: ${JSON.stringify(errorData)}`);
  }

  return await res.json();
}
