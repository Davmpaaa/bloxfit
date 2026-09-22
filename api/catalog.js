export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const q = String(req.query.q || "").trim().slice(0, 80);
  const requestedSubcategory = String(req.query.subcategory || "1");

  const maxPrice = String(req.query.maxPrice || "")
    .replace(/\D/g, "")
    .slice(0, 6);

  if (!q) {
    return res.status(400).json({
      error: "Missing search query"
    });
  }

  // Roblox Marketplace subcategory IDs
  const validSubcategories = new Set([
    "1",  // All
    "3",  // Clothing
    "9",  // Hats
    "10", // Faces
    "12", // Shirts
    "13", // T-Shirts
    "14", // Pants
    "19", // Accessories
    "20", // Hair Accessories
    "21", // Face Accessories
    "22", // Neck Accessories
    "23", // Shoulder Accessories
    "24", // Front Accessories
    "25", // Back Accessories
    "26", // Waist Accessories
    "54", // Head Accessories
    "55", // Classic T-Shirts
    "56", // Classic Shirts
    "57", // Classic Pants
    "58", // T-Shirt Accessories
    "59", // Shirt Accessories
    "60", // Pants Accessories
    "61", // Jacket Accessories
    "62", // Sweater Accessories
    "63", // Shorts Accessories
    "65", // Dress/Skirt Accessories
    "66"  // Dynamic Heads
  ]);

  const subcategory = validSubcategories.has(requestedSubcategory)
    ? requestedSubcategory
    : "1";

  const params = new URLSearchParams();

  params.set("Category", "1");
  params.set("Subcategory", subcategory);
  params.set("Keyword", q);
  params.set("Limit", "30");
  params.set("SortType", "0");
  params.set("SortAggregation", "5");

  if (maxPrice) {
    params.set("MaxPrice", maxPrice);
  }

  try {
    const robloxUrl =
      `https://catalog.roblox.com/v1/search/items/details?${params.toString()}`;

    const catalogResponse = await fetch(robloxUrl, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    if (!catalogResponse.ok) {
      const robloxError = await catalogResponse.text();

      return res.status(502).json({
        error: `Roblox catalog HTTP ${catalogResponse.status}`,
        robloxDetail: robloxError,
        request: robloxUrl
      });
    }

    const catalog = await catalogResponse.json();

    const items = Array.isArray(catalog.data)
      ? catalog.data.slice(0, 30)
      : [];

    const assetIds = items
      .filter(item => item.itemType === "Asset" && item.id)
      .map(item => item.id);

    const thumbnails = {};

    if (assetIds.length > 0) {
      const thumbParams = new URLSearchParams({
        assetIds: assetIds.join(","),
        returnPolicy: "PlaceHolder",
        size: "420x420",
        format: "Png",
        isCircular: "false"
      });

      const thumbnailResponse = await fetch(
        `https://thumbnails.roblox.com/v1/assets?${thumbParams.toString()}`
      );

      if (thumbnailResponse.ok) {
        const thumbnailData = await thumbnailResponse.json();

        for (const thumb of thumbnailData.data || []) {
          thumbnails[String(thumb.targetId)] =
            thumb.imageUrl || null;
        }
      }
    }

    res.setHeader(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=300"
    );

    return res.status(200).json({
      source: "Roblox Marketplace",
      count: items.length,

      data: items.map(item => ({
        id: item.id,
        itemType: item.itemType,
        name: item.name,
        creatorName: item.creatorName || null,
        price:
          typeof item.price === "number"
            ? item.price
            : null,
        priceStatus: item.priceStatus || null,

        thumbnail:
          thumbnails[String(item.id)] || null,

        url:
          item.itemType === "Bundle"
            ? `https://www.roblox.com/bundles/${item.id}`
            : `https://www.roblox.com/catalog/${item.id}`
      }))
    });

  } catch (error) {
    return res.status(500).json({
      error: "BloxFit proxy failed",
      detail: String(error?.message || error)
    });
  }
}
