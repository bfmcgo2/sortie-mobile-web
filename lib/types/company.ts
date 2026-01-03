// Company Guide Data Structure
export interface CompanyGuide {
  id: string;
  name: string;
  logo: string; // URL to company logo image
  city: string;
  description?: string;
  // Add more fields as needed for the guide content
}

// Sample JSON structure:
/*
{
  "id": "company-123",
  "name": "Company Name",
  "logo": "https://example.com/logo.png",
  "city": "City Name",
  "description": "Optional company description"
}
*/

