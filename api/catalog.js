export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const q = String(req.query.q || "").trim().slice(0, 80);
  const subcategory = String(req.query.subcategory || "1");
  const maxPrice = String(req.query.maxPrice || "")
    .replace(/\D/g, "")
    .slice(0, 6);

  if (!q) {
    return res.status(400).json({ error: "Missing search query" });
  }

  const params = new URLSearchParams({
    Category: "1",
    Subcategory: subcategory,
    Limit: "30",
    Keyword: q,
    SortType: "0",
    SortAggregation: "5"
  });

  if (maxPrice) params.set("MaxPrice", maxPrice);

  try {
    const catalogResponse = await fetch(
      `https://catalog.roblox.com/v1/search/items/details?${params}`
    );

    if (!catalogResponse.ok) {
      return res.status(502).json({
        error: `Roblox catalog HTTP ${catalogResponse.status}`
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

    if (assetIds.length) {
      const thumbnailResponse = await fetch(
        `https://thumbnails.roblox.com/v1/assets?assetIds=${assetIds.join(",")}&returnPolicy=PlaceHolder&size=420x420&format=Png&isCircular=false`
      );

      if (thumbnailResponse.ok) {
        const thumbnailData = await thumbnailResponse.json();

        for (const thumb of thumbnailData.data || []) {
          thumbnails[String(thumb.targetId)] = thumb.imageUrl;
        }
      }
    }

    res.setHeader(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=300"
    );

    return res.status(200).json({
      source: "Roblox",
      data: items.map(item => ({
        id: item.id,
        itemType: item.itemType,
        name: item.name,
        creatorName: item.creatorName,
        price: item.price,
        priceStatus: item.priceStatus,
        thumbnail: thumbnails[String(item.id)] || null,
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
