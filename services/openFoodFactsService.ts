import { BarcodeScannedFoodInfo } from '../types.ts';

/**
 * Fetches food product information from the Open Food Facts API using a barcode.
 * @param barcode The EAN/UPC barcode string.
 * @returns A promise that resolves to a `BarcodeScannedFoodInfo` object.
 * @throws An error if the product is not found or the API call fails.
 */
export const getFoodInfoFromBarcode = async (barcode: string): Promise<BarcodeScannedFoodInfo> => {
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,image_front_url,serving_size,nutriments`);
  
  if (!response.ok) {
    throw new Error('Produkten kunde inte hittas i databasen.');
  }
  const data = await response.json();

  if (data.status === 0 || !data.product) {
    throw new Error(`Ingen produkt hittades för streckkoden ${barcode}.`);
  }

  const p = data.product;
  const nutriments = p.nutriments || {};

  // Find the most appropriate calorie value, preferring kcal
  const calories = nutriments['energy-kcal_100g'] || (nutriments.energy_100g / 4.184) || 0;

  return {
    name: p.product_name || 'Okänt namn',
    brand: p.brands || 'Okänt märke',
    imageUrl: p.image_front_url || undefined,
    servingSizeG: p.serving_size ? parseFloat(p.serving_size) : undefined,
    nutrientsPer100g: {
      calories: calories,
      protein: nutriments.proteins_100g || 0,
      carbohydrates: nutriments.carbohydrates_100g || 0,
      fat: nutriments.fat_100g || 0,
    },
  };
};
