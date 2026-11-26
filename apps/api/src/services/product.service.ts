import dns from "node:dns/promises";
import net from "node:net";
import { prisma } from "@replyza/database";
import type {
  BulkImportProductsInput,
  CreateProductInput,
  UpdateProductInput,
} from "../validators/product.validator";

export class ProductError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "ProductError";
  }
}

export interface ProductListFilters {
  search?: string;
  category?: string;
  brand?: string;
  status?: "ACTIVE" | "ARCHIVED";
}

export interface ExtractedMetadata {
  url: string;
  title: string | null;
  imageUrl: string | null;
  description: string | null;
  price: string | null;
  extracted: boolean;
  warning?: string;
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4) return true;
    const [a, b] = parts;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("::ffff:")) {
      return isPrivateOrReservedIp(lower.slice(7));
    }
    return false;
  }
  return true;
}

async function assertSafeExternalUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ProductError("Only HTTP and HTTPS URLs are supported", 400);
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new ProductError("Private or local URLs cannot be fetched", 400);
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new ProductError("Private IP addresses cannot be fetched", 400);
    }
    return parsed;
  }

  try {
    const records = await dns.lookup(hostname, { all: true });
    if (records.length === 0 || records.some((r) => isPrivateOrReservedIp(r.address))) {
      throw new ProductError("URL resolves to a restricted network address", 400);
    }
  } catch (err) {
    if (err instanceof ProductError) throw err;
    // DNS resolution failed; allow caller to handle fetch fallback gracefully
  }

  return parsed;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .trim();
}

function extractMetaTag(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        "i"
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
        "i"
      ),
    ];
    for (const pattern of patterns) {
      const m = html.match(pattern);
      if (m?.[1]) {
        return decodeHtmlEntities(m[1]);
      }
    }
  }
  return null;
}

export async function extractUrlMetadata(rawUrl: string): Promise<ExtractedMetadata> {
  let targetUrl: URL;
  try {
    targetUrl = await assertSafeExternalUrl(rawUrl);
  } catch (err) {
    return {
      url: rawUrl,
      title: null,
      imageUrl: null,
      description: null,
      price: null,
      extracted: false,
      warning: err instanceof Error ? err.message : "Invalid URL for metadata extraction",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(targetUrl.toString(), {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": "ReplyzaBot/1.0 (+https://replyza.buzz)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return {
        url: rawUrl,
        title: null,
        imageUrl: null,
        description: null,
        price: null,
        extracted: false,
        warning: `Site returned HTTP ${response.status}; please enter details manually.`,
      };
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return {
        url: rawUrl,
        title: null,
        imageUrl: null,
        description: null,
        price: null,
        extracted: false,
        warning: "URL did not return an HTML page; please enter details manually.",
      };
    }

    const text = (await response.text()).slice(0, 512_000);
    const ogTitle = extractMetaTag(text, ["og:title", "twitter:title"]);
    const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = ogTitle || (titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1]) : null);

    let imageUrl = extractMetaTag(text, ["og:image", "twitter:image", "og:image:secure_url"]);
    if (imageUrl && imageUrl.startsWith("/")) {
      imageUrl = `${targetUrl.origin}${imageUrl}`;
    }

    const description = extractMetaTag(text, ["og:description", "twitter:description", "description"]);
    const priceAmount = extractMetaTag(text, [
      "product:price:amount",
      "og:price:amount",
      "twitter:data1",
    ]);
    const priceCurrency = extractMetaTag(text, ["product:price:currency", "og:price:currency"]);
    const price = priceAmount
      ? priceCurrency && !priceAmount.includes(priceCurrency)
        ? `${priceCurrency} ${priceAmount}`
        : priceAmount
      : null;

    const extracted = Boolean(title || imageUrl || description || price);
    return {
      url: rawUrl, // Always preserve original affiliate URL verbatim
      title: title ? title.slice(0, 160) : null,
      imageUrl,
      description: description ? description.slice(0, 500) : null,
      price: price ? price.slice(0, 40) : null,
      extracted,
      warning: extracted
        ? undefined
        : "No OpenGraph metadata found on page; please fill in product details manually.",
    };
  } catch {
    return {
      url: rawUrl,
      title: null,
      imageUrl: null,
      description: null,
      price: null,
      extracted: false,
      warning: "Could not fetch metadata from this site (blocked or timed out). Please enter details manually.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function listProducts(userId: string, filters: ProductListFilters = {}) {
  const where: Record<string, unknown> = { userId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.category && filters.category !== "ALL") {
    where.category = filters.category;
  }
  if (filters.brand && filters.brand !== "ALL") {
    where.brand = filters.brand;
  }
  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
      { affiliatePartner: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  return prisma.affiliateProduct.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

export async function getProductById(userId: string, productId: string) {
  const product = await prisma.affiliateProduct.findFirst({
    where: { id: productId, userId },
  });
  if (!product) {
    throw new ProductError("Product not found", 404);
  }
  return product;
}

export async function createProduct(userId: string, input: CreateProductInput) {
  return prisma.affiliateProduct.create({
    data: {
      userId,
      name: input.name,
      brand: input.brand ?? null,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      affiliateUrl: input.affiliateUrl,
      originalUrl: input.originalUrl ?? null,
      price: input.price ?? null,
      discountPrice: input.discountPrice ?? null,
      discountInfo: input.discountInfo ?? null,
      couponCode: input.couponCode ?? null,
      affiliatePartner: input.affiliatePartner ?? null,
      category: input.category ?? null,
      ctaLabel: input.ctaLabel || "Shop Now",
      notes: input.notes ?? null,
      status: input.status ?? "ACTIVE",
    },
  });
}

export async function updateProduct(
  userId: string,
  productId: string,
  input: UpdateProductInput
) {
  await getProductById(userId, productId);
  return prisma.affiliateProduct.update({
    where: { id: productId },
    data: input,
  });
}

export async function duplicateProduct(userId: string, productId: string) {
  const existing = await getProductById(userId, productId);
  return prisma.affiliateProduct.create({
    data: {
      userId,
      name: `${existing.name} (Copy)`.slice(0, 160),
      brand: existing.brand,
      description: existing.description,
      imageUrl: existing.imageUrl,
      affiliateUrl: existing.affiliateUrl,
      originalUrl: existing.originalUrl,
      price: existing.price,
      discountPrice: existing.discountPrice,
      discountInfo: existing.discountInfo,
      couponCode: existing.couponCode,
      affiliatePartner: existing.affiliatePartner,
      category: existing.category,
      ctaLabel: existing.ctaLabel,
      notes: existing.notes,
      status: existing.status,
    },
  });
}

export async function deleteProduct(userId: string, productId: string) {
  await getProductById(userId, productId);
  await prisma.affiliateProduct.delete({
    where: { id: productId },
  });
}

export function parseBulkProductLines(rawText: string): Array<{
  name: string;
  affiliateUrl: string;
  valid: boolean;
  error?: string;
}> {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    const pipeIdx = line.indexOf("|");
    let name: string;
    let url: string;

    if (pipeIdx > 0) {
      name = line.slice(0, pipeIdx).trim();
      url = line.slice(pipeIdx + 1).trim();
    } else {
      url = line;
      try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, "");
        name = `Product ${index + 1} (${host})`;
      } catch {
        name = `Product ${index + 1}`;
      }
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { name, affiliateUrl: url, valid: false, error: "URL must use http(s)://" };
      }
      return { name: name || `Product ${index + 1}`, affiliateUrl: url, valid: true };
    } catch {
      return { name: name || `Product ${index + 1}`, affiliateUrl: url, valid: false, error: "Invalid URL" };
    }
  });
}

export async function bulkImportProducts(
  userId: string,
  input: BulkImportProductsInput
) {
  const toCreate: Array<{
    name: string;
    affiliateUrl: string;
    originalUrl?: string | null;
    imageUrl?: string | null;
    description?: string | null;
    price?: string | null;
    discountPrice?: string | null;
    brand?: string | null;
    category?: string | null;
    ctaLabel?: string;
  }> = [];

  if (input.items && input.items.length > 0) {
    toCreate.push(...input.items);
  } else if (input.rawText) {
    const parsed = parseBulkProductLines(input.rawText);
    const invalid = parsed.filter((p) => !p.valid);
    if (invalid.length > 0) {
      throw new ProductError(
        `Invalid URL on line(s): ${invalid.map((i) => i.affiliateUrl).join(", ")}`,
        400
      );
    }
    for (const item of parsed.slice(0, 50)) {
      if (input.extractMetadata) {
        const meta = await extractUrlMetadata(item.affiliateUrl);
        toCreate.push({
          name: item.name.startsWith("Product ") && meta.title ? meta.title : item.name,
          affiliateUrl: item.affiliateUrl,
          imageUrl: meta.imageUrl,
          description: meta.description,
          price: meta.price,
        });
      } else {
        toCreate.push({
          name: item.name,
          affiliateUrl: item.affiliateUrl,
        });
      }
    }
  }

  if (toCreate.length === 0) {
    throw new ProductError("No valid products provided to import", 400);
  }

  const created = await prisma.$transaction(
    toCreate.map((item) =>
      prisma.affiliateProduct.create({
        data: {
          userId,
          name: item.name,
          affiliateUrl: item.affiliateUrl,
          originalUrl: item.originalUrl ?? null,
          imageUrl: item.imageUrl ?? null,
          description: item.description ?? null,
          price: item.price ?? null,
          discountPrice: item.discountPrice ?? null,
          brand: item.brand ?? null,
          category: item.category ?? null,
          ctaLabel: item.ctaLabel || "Shop Now",
          status: "ACTIVE",
        },
      })
    )
  );

  return created;
}
