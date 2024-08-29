'use server';
import { google } from "googleapis";

export async function getSheetData() { 
  const glAuth = await google.auth.getClient({
        projectId: "peak-text-299311",
        credentials: {
                "type": "service_account",
                "project_id": "peak-text-299311",
                "private_key_id": "7eeedb1c154a7c12f0f324f23f02e1412694eb93",
                "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCSOkdRh5yoR62c\nHbQCXdg6bX/4Qh4XkwT2gZ0Unn8t19qgRGmU3XTfXf9zpAyFQNpTuPeDhpP59bBj\nz8A66qO9FnGCp7Bw1yvVyrKais7oIOfoNsNdbaqMeR1PHep2fnXfwKTD6CF5deoG\nKHE0gh3btZ7+gDzGViXwkBtBcOBI67fpxEgf7zt6rIOdr06DJiOVcIyz0dqxu0ri\nFRHwLAGl2ZU6af9hwVhbPJpW1R5p15ZNtQtB+YCnaVypciXBMJ3EDA8JbsDvGwIe\nD7MJ7x5uHr5aFE9BDI1Pdj/HR2fHZPu41o8FHVLaAkPhB/+zhOLnV6nSCDwZtMdB\naXx8h/hTAgMBAAECggEARilzbeGxX6cg3I79/8KyjPpcVCy5Tptq3rJ7Qdj48fCn\nxI1+0YBe4wwxlXWJ0mg3OcO+81tf5igmTgXxWPObxA8gQM4gIUyFCmxbPT7MH2Im\nk+uu2sXTdtpoHz2d8eQkv8sp45web66Nrw25n7WtCO5AzyGNx6avRpmGkmRMIYBL\nDJUO4YtnbOz6vp8c3+3cRqhHJoVHrHwW4aFWToX1eSIkeFpDbp3suuxtC7SDmGkI\nOXCNMHMnjGViiPoJYtmLBJg4esIWw0bl3dK+HuxqvnvpctOtLrqzlZOFHrD8cQIt\ndlDJJTLIbRql6j23/cWqZ91H0vw7oiQzBt+bqAKVvQKBgQDDj0m5cRlqGfkCHEPp\nVQMCkgcfpaObEFtAbJqyNp1CdOcYMEdZfUXdx89A+VmkbuhwT0VGSaHOcrMadaK+\nZZVoD7EVZzRqiRqzMfMHqwyy7mR08jmMeV9J1qPvR6ebiIofpfS2/wQnUTAjGHNE\nr9CIVrWr6oxZcoid5eLjhNPKDQKBgQC/a9SfT2xzzCsMRwM303OyBJFB+43w8NJb\n3R26pDBvyE8iCev5bt2LFlN9PeYIUby+9v5QfeG9fCV0Ns9AC6hRZ0QBJvOAexCe\nJTRU9svniHMW7dn4mfMJwfXGfUlvsJOY2EjrEeppKtb2tRHfhvlRw6SpGcI2Bc00\n8hwrSTwT3wKBgCgTFvKPgLvDcsnB7RDFwQYn0pnjobFHGswK9XCLzJIvzqOgUR6/\nky+toIUaFAqkR7GsLPAIasYZryY+8Qi/XGykuo8+RPmH+xa5p6nsnX+VZrSoZq6o\nuKQy/gksz+YJhvSRV6Kgg8Ni2dB3VDfBJ6So0DXYrMYvuFtTHrmtIJGJAoGAM8D8\nuKHpqZk+3k/oz9QsyKmxeEyCAO2rgkjTO94edmqK8qIKGeNepLdBlXAB3Kf0xxDS\ni4KtYOTK35PeDuvX80JfQYx9c3RSdt+KOZqMYKokq8NdFnjRHAdD4wmGrFrqXP3F\nIUEzxoFdo1ArZ+r/R5sEzu928dI5vCHledKQGrMCgYEAjG/YCGRnwovbNenPIZ2v\nOsl/+0Yh1AU+V9rVG2Q4atqHYSHD/ZzXhDzzormiq0bCRegL2D55FUN06i/XoCU3\nCGkvHas/CudB5CPRJvGQvZOKWeJkxXNtwNQ61KCYYpJSGScdRavpvkua2he1W2Qf\nGbI/wFARtXcz5VMi0WZDwyA=\n-----END PRIVATE KEY-----\n",
                "client_email": "dzr-36@peak-text-299311.iam.gserviceaccount.com",
                "client_id": "110993671398402161026",
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