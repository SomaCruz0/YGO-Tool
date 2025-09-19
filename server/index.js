const express = require('express');
const cors = require('cors');
require('dotenv').config()

const app = express();
app.use(cors());
app.use(express.json());

// Helper function to get TCG Corner headers with Vietnam region forcing
const getTCGCornerHeaders = () => {
    // Rotate Vietnam IPs to avoid detection
    const vietnamIPs = [
        '14.187.53.1',    // Viettel
        '125.212.226.1',  // VNPT
        '171.224.176.1',  // FPT
        '103.9.76.1',     // CMC
        '210.245.31.1'    // SPT
    ];
    const randomIP = vietnamIPs[Math.floor(Math.random() * vietnamIPs.length)];

    console.log(`🇻🇳 Using Vietnam IP: ${randomIP} for TCG Corner request`);

    return {
        'accept': 'application/json',
        'referer': 'https://tcg-corner.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'accept-language': 'vi-VN,vi;q=0.9,en;q=0.8',
        'x-forwarded-for': randomIP,
        'x-real-ip': randomIP,
        'cf-ipcountry': 'VN',
        'x-country-code': 'VN'
    };
};

app.get('/api/health', (req, res) => {
    console.log(`API listening on http://localhost:${port}`);
    res.json({ ok: true });
});

// Resolve a print code like "MP25-EN021" to { id, name }
app.get('/api/printcode/resolve', async (req, res) => {
    try {
        const raw = typeof req.query.code === 'string' ? req.query.code.trim() : ''
        if (!raw) return res.status(400).json({ error: 'Missing code' })

        // Normalize dashes and uppercase
        const input = raw
            .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
            .replace(/\s+/g, ' ')
            .toUpperCase()

        // Try strict pattern first; fall back to loose extraction (take last 3 digits)
        let prefix, index
        const strict = input.match(/^([A-Z0-9]+-[A-Z]{2})-([0-9]{3})$/)
        if (strict) {
            prefix = strict[1]
            index = strict[2]
        } else {
            const idxMatch = input.match(/(\d{3})$/)
            if (!idxMatch) return res.status(422).json({ error: 'Cannot parse last 3 digits', code: input })
            index = idxMatch[1]
            prefix = input.replace(new RegExp(`${index}$`), '')
                .replace(/-$/, '')
        }

        const idxUrl = `https://db.ygoresources.com/data/idx/printcode/${encodeURIComponent(prefix)}`
        const idxRes = await fetch(idxUrl, {
            headers: {
                'accept': 'application/json',
                'user-agent': 'Mozilla/5.0 (YGO-Tool Server)'
            }
        })
        if (!idxRes.ok) {
            const detail = await idxRes.text().catch(() => '')
            return res.status(idxRes.status).json({ error: 'Upstream idx error', detail, prefix, index })
        }
        const idxJson = await idxRes.json()
        const id = idxJson && idxJson[index]
        if (!id) return res.status(404).json({ error: 'ID not found for code', code: input, prefix, index })

        const cardUrl = `https://db.ygoresources.com/data/card/${encodeURIComponent(id)}`
        const cardRes = await fetch(cardUrl, {
            headers: {
                'accept': 'application/json',
                'user-agent': 'Mozilla/5.0 (YGO-Tool Server)'
            }
        })
        if (!cardRes.ok) {
            const detail = await cardRes.text().catch(() => '')
            return res.status(cardRes.status).json({ error: 'Upstream card error', detail, id })
        }
        const cardJson = await cardRes.json()
        const cardData = cardJson && cardJson.cardData
        const name = (cardData?.en?.name)
            || (cardData?.ae?.name)
            || (Object.values(cardData || {})?.[0]?.name)
            || null
        if (!name) return res.status(502).json({ error: 'Missing name in cardData' })

        return res.json({ ok: true, code: input, id, name })
    } catch (err) {
        return res.status(500).json({ error: 'Server error', detail: String(err) })
    }
})

// Helper function to check if setcode contains "AE" after dash
const isAECard = (setcode) => {
    const parts = setcode.split('-');
    return parts.length >= 2 && parts[1].startsWith('AE');
};

app.get('/api/cardsetsinfo', async (req, res) => {
    const raw = typeof req.query.setcode === 'string' ? req.query.setcode : ''
    const codes = raw.split(',').map(s => s.trim()).filter(Boolean)

    if (codes.length === 0) {
        return res.status(400).json({ error: 'Missing or invalid setcode' })
    }

    try {
        const results = await Promise.all(codes.map(async code => {
            try {
                // Check if this is an AE card - use TCG Corner API
                if (isAECard(code)) {
                    // Try multiple endpoints to get all products including sold out
                    const endpoints = [
                        `https://tcg-corner.com/search/suggest.json?q=${encodeURIComponent(code)}&resources[type]=product&resources[limit]=50`,
                    ];

                    let tcgResponse = null;
                    let tcgData = null;

                    // Try each endpoint until we get results
                    for (const endpoint of endpoints) {
                        try {
                            tcgResponse = await fetch(endpoint, {
                                headers: getTCGCornerHeaders()
                            });

                            if (tcgResponse.ok) {
                                tcgData = await tcgResponse.json();
                                // Check if we got products
                                const products = tcgData?.resources?.results?.products || tcgData?.products || [];
                                if (products.length > 0) {
                                    console.log(`Found ${products.length} products using endpoint: ${endpoint}`);

                                    // Try to get more detailed info using individual product endpoints
                                    if (products.length > 0 && products[0].handle) {
                                        console.log(`Trying individual product endpoints for more details...`);
                                        const detailedProducts = [];

                                        for (const product of products.slice(0, 5)) { // Limit to first 5 products
                                            try {
                                                const productResponse = await fetch(`https://tcg-corner.com/products/${product.handle}.json`, {
                                                    headers: getTCGCornerHeaders()
                                                });

                                                if (productResponse.ok) {
                                                    const productData = await productResponse.json();
                                                    console.log(`Got detailed product data for ${product.handle}`);
                                                    detailedProducts.push({
                                                        ...product,
                                                        ...productData.product,
                                                        detailed: true
                                                    });
                                                }
                                            } catch (e) {
                                                console.log(`Failed to get details for ${product.handle}:`, e.message);
                                                detailedProducts.push(product);
                                            }
                                        }

                                        if (detailedProducts.length > 0) {
                                            tcgData = { ...tcgData, products: detailedProducts };
                                        }
                                    }

                                    break;
                                }
                            }
                        } catch (e) {
                            console.log(`Endpoint failed: ${endpoint}`, e.message);
                            continue;
                        }
                    }

                    if (!tcgResponse || !tcgResponse.ok) {
                        const detail = tcgResponse ? await tcgResponse.text().catch(() => '') : 'No working endpoint found'
                        return { ok: false, setcode: code, status: tcgResponse?.status || 404, error: 'TCG Corner error', detail }
                    }

                    // Extract products from different response formats
                    const rawProducts = tcgData?.resources?.results?.products || tcgData?.products || [];
                    const products = rawProducts.map(p => {
                        // Handle both regular products and detailed products from individual endpoints
                        const isDetailed = p.detailed === true;
                        const productData = isDetailed ? p : p;

                        return {
                            id: productData.id,
                            title: productData.title,
                            handle: productData.handle,
                            price: productData.price || productData.variants?.[0]?.price,
                            price_min: productData.price_min || productData.price,
                            price_max: productData.price_max || productData.price,
                            available: productData.available !== undefined ? productData.available :
                                (productData.variants?.some(v => v.available) ?? true),
                            sold_out: productData.available === false || productData.sold_out === true ||
                                (productData.variants && !productData.variants.some(v => v.available)),
                            url: `https://tcg-corner.com/products/${productData.handle}`,
                            image: productData.image || productData.featured_image || productData.images?.[0]?.src,
                            variants: productData.variants || [],
                            inventory_quantity: productData.variants?.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0) || 0
                        };
                    })

                    return {
                        ok: true,
                        setcode: code,
                        data: {
                            name: products[0]?.title || code,
                            set_code: code,
                            set_name: 'TCG Corner Search',
                            set_rarity: 'Various',
                            set_price: products[0]?.price || 'N/A',
                            source: 'tcg-corner',
                            currency: 'VND',
                            products: products
                        }
                    }
                } else {
                    // Use YGOProDeck API for non-AE cards
                    const r = await fetch(`https://db.ygoprodeck.com/api/v7/cardsetsinfo.php?setcode=${encodeURIComponent(code)}`)
                    if (!r.ok) {
                        const detail = await r.text().catch(() => '')
                        return { ok: false, setcode: code, status: r.status, error: 'Upstream error', detail }
                    }
                    const data = await r.json()
                    return { ok: true, setcode: code, data: { ...data, source: 'ygoprodeck', currency: 'USD' } }
                }
            } catch (e) {
                return { ok: false, setcode: code, error: String(e) }
            }
        }))
        return res.json({ count: results.length, results })
    } catch (err) {
        return res.status(500).json({ error: 'Server error', detail: String(err) })
    }
});

app.get('/api/tcg/search', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    if (!q) return res.status(400).json({ error: 'Missing q' })
    try {
        const url = `https://tcg-corner.com/search/suggest.json?q=${encodeURIComponent(q)}&resources[type]=product&resources[limit]=10`
        const r = await fetch(url, {
            headers: getTCGCornerHeaders()
        })
        if (!r.ok) {
            const detail = await r.text().catch(() => '')
            return res.status(r.status).json({ error: 'Upstream error', detail })
        }
        const json = await r.json()
        // Chuẩn hóa kết quả: lấy danh sách products (nếu có) và map ra title/handle/price
        const baseProducts = (json?.resources?.results?.products || []).map(p => ({
            id: p.id,
            title: p.title,
            handle: p.handle,
            price: p.price,
            price_min: p.price_min,
            price_max: p.price_max,
            url: `https://tcg-corner.com/products/${p.handle}`,
            image: p.image
        }))

        // Helper: extract rarity text from a variant title/options
        const extractRarity = (variant) => {
            const source = [variant?.title, ...(variant?.options || [])].filter(Boolean).join(' ').toLowerCase()
            const known = [
                'quarter century', '25th', 'starlight', 'ultimate rare', 'collector', 'prismatic',
                'secret rare', 'ultra rare', 'super rare', 'rare', 'common'
            ]
            for (const key of known) {
                if (source.includes(key)) return key
            }
            return null
        }

        // Fetch detailed product JSON to get full variants (rarities)
        const headers = getTCGCornerHeaders()
        const detailedProducts = await Promise.all(baseProducts.slice(0, 10).map(async (p) => {
            try {
                const pr = await fetch(`https://tcg-corner.com/products/${p.handle}.json`, { headers })
                if (!pr.ok) return p
                const pdata = await pr.json()
                const product = pdata?.product || {}
                const variants = (product.variants || []).map(v => ({
                    id: v.id,
                    title: v.title,
                    price: v.price,
                    available: v.available,
                    inventory_quantity: v.inventory_quantity,
                    sku: v.sku,
                    options: v.options,
                    rarity: extractRarity(v)
                }))

                // Derive product-level availability/price from variants if missing
                const price = p.price ?? variants[0]?.price ?? null
                const price_min = p.price_min ?? variants.reduce((m, v) => m === null ? v.price : Math.min(m, v.price), null)
                const price_max = p.price_max ?? variants.reduce((m, v) => m === null ? v.price : Math.max(m, v.price), null)
                const available = variants.some(v => v.available)

                return {
                    ...p,
                    price, price_min, price_max,
                    available,
                    variants,
                    images: product.images,
                }
            } catch {
                return p
            }
        }))

        const flatVariants = detailedProducts.flatMap(prod => (prod.variants || []).map(v => ({
            product_id: prod.id,
            product_title: prod.title,
            product_handle: prod.handle,
            url: prod.url,
            image: prod.image,
            variant_id: v.id,
            variant_title: v.title,
            rarity: v.rarity,
            price: v.price,
            available: v.available,
            inventory_quantity: v.inventory_quantity
        })))

        return res.json({ query: q, count: detailedProducts.length, products: detailedProducts, variants: flatVariants })
    } catch (err) {
        return res.status(500).json({ error: 'Server error', detail: String(err) })
    }
})

// Fetch TCG Corner product .js to include sold-out items (by handle or full URL)
app.get('/api/tcg-corner/product', async (req, res) => {
    try {
        const input = typeof req.query.q === 'string' ? req.query.q.trim() : ''
        if (!input) return res.status(400).json({ error: 'Missing q' })

        // Accept full URL or handle
        let handle = input
        try {
            const u = new URL(input)
            const m = u.pathname.match(/\/products\/([^/.]+)/)
            if (m) handle = m[1]
        } catch (_) {
            // not a URL, assume handle or handle.js
            handle = input.replace(/\.(js|json)$/i, '')
        }

        const jsUrl = `https://tcg-corner.com/products/${encodeURIComponent(handle)}.js`
        const r = await fetch(jsUrl, {
            headers: {
                ...getTCGCornerHeaders(),
                'accept': 'application/javascript, application/json'
            }
        })
        if (!r.ok) {
            const detail = await r.text().catch(() => '')
            return res.status(r.status).json({ error: 'Upstream error', detail })
        }
        const text = await r.text()
        // The .js endpoint is actually JSON content
        let json
        try { json = JSON.parse(text) } catch {
            // try to eval as JS assignment? Normally not needed; return raw
            return res.status(502).json({ error: 'Invalid JS JSON', raw: text })
        }

        const p = json
        const variants = Array.isArray(p?.variants) ? p.variants : []
        const available = variants.some(v => v?.available)
        const sold_out = !available
        const normalized = {
            id: p?.id,
            title: p?.title,
            handle: p?.handle || handle,
            description: p?.description,
            price: p?.price,
            price_min: p?.price_min,
            price_max: p?.price_max,
            available,
            sold_out,
            url: `https://tcg-corner.com/products/${p?.handle || handle}`,
            image: p?.featured_image || p?.images?.[0] || null,
            variants: variants.map(v => ({
                id: v.id,
                title: v.title,
                price: v.price,
                available: v.available,
                inventory_quantity: v.inventory_quantity,
                sku: v.sku
            }))
        }
        return res.json({ ok: true, product: normalized })
    } catch (err) {
        return res.status(500).json({ error: 'Server error', detail: String(err) })
    }
})

// Proxy to JustTCG cards endpoint using server-side API key
app.get('/api/justtcg/cards', async (req, res) => {
    try {
        const name = typeof req.query.name === 'string' ? req.query.name.trim() : ''
        if (!name) return res.status(400).json({ error: 'Missing name' })

        const apiKey = process.env.JUSTTCG_KEY
        const base = 'https://api.justtcg.com/v1/cards'

        // Try common search param names
        // The docs show one high-performance /cards endpoint that supports search
        const candidates = [
            `${base}?q=${encodeURIComponent(name)}`,
            `${base}?name=${encodeURIComponent(name)}`
        ]

        let lastErr = null
        for (const url of candidates) {
            try {
                const r = await fetch(url, {
                    headers: {
                        'X-API-Key': apiKey,
                        'accept': 'application/json'
                    }
                })
                const text = await r.text()
                let json
                try { json = JSON.parse(text) } catch { json = { raw: text } }
                if (!r.ok) {
                    lastErr = { status: r.status, body: json }
                    continue
                }
                return res.json(json)
            } catch (e) {
                lastErr = { error: String(e) }
            }
        }
        return res.status(502).json({ error: 'Upstream JustTCG error', detail: lastErr })
    } catch (err) {
        return res.status(500).json({ error: 'Server error', detail: String(err) })
    }
})

const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
});
