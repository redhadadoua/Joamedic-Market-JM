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
            title: "Orders",
            gridProperties: {
              frozenRowCount: 1
            }
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
  const spreadsheetId = data.spreadsheetId;
  const sheetId = data.sheets[0].properties.sheetId;

  // Apply beautiful formatting
  await formatSpreadsheet(spreadsheetId, sheetId);

  return spreadsheetId;
}

async function formatSpreadsheet(spreadsheetId: string, sheetId: number) {
  const token = await getAccessToken();
  if (!token) return;

  const batchUpdateRequest = {
    requests: [
      {
        updateSheetProperties: {
          properties: {
            sheetId: sheetId,
            rightToLeft: true // Enable RTL for Arabic
          },
          fields: "rightToLeft"
        }
      },
      {
        repeatCell: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.05, green: 0.5, blue: 0.5 }, // Teal color
              horizontalAlignment: "CENTER",
              textFormat: {
                foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                fontSize: 12,
                bold: true
              }
            }
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
        }
      },
      {
        autoResizeDimensions: {
          dimensions: {
            sheetId: sheetId,
            dimension: "COLUMNS",
            startIndex: 0,
            endIndex: 11
          }
        }
      }
    ]
  };

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(batchUpdateRequest)
  });
}

export async function syncAllOrdersToSheet(spreadsheetId: string, values: string[][]) {
  const token = await getAccessToken();
  if (!token) throw new Error("No Google access token available");

  // First, clear the existing data
  const clearRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Orders!A:Z:clear`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!clearRes.ok) {
    console.error("Failed to clear sheet before sync");
  }

  // Insert the new data including headers
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Orders!A1:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: values
    })
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(`Failed to sync orders: ${JSON.stringify(errorData)}`);
  }

  return await res.json();
}
