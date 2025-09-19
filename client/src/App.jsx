import { useState } from 'react'
import * as XLSX from 'xlsx'

function App() {
    const [setcodes, setSetcodes] = useState('')
    const [cardName, setCardName] = useState('')
    const [activeTab, setActiveTab] = useState('ae') // 'ae' or 'tcg'
    const [aePriceExtra, setAePriceExtra] = useState('')
    const [tcgRate, setTcgRate] = useState('25000')
    const [oosHandles, setOosHandles] = useState('')
    const [showOosSearch, setShowOosSearch] = useState(false)

    // Separate state for each tab
    const [aeResults, setAeResults] = useState(null)
    const [tcgResults, setTcgResults] = useState(null)
    const [aeLoading, setAeLoading] = useState(false)
    const [tcgLoading, setTcgLoading] = useState(false)
    const [aeError, setAeError] = useState(null)
    const [tcgError, setTcgError] = useState(null)
    const applyAeBulkPrice = () => {
        const delta = Number(aePriceExtra)
        if (!isFinite(delta)) return
        if (!aeResults || !Array.isArray(aeResults.results)) return
        const updated = aeResults.results.map(r => {
            if (!r?.ok) return r
            const d = r.data || {}
            if (d.source !== 'tcg-corner') return r
            const current = Number(d.set_price)
            if (!isFinite(current)) return r
            return {
                ...r,
                data: { ...d, set_price: (current + delta).toFixed(2) }
            }
        })
        setAeResults({ ...aeResults, results: updated })
    }

    const applyTcgRate = () => {
        const rate = Number(tcgRate)
        if (!isFinite(rate) || rate <= 0) return
        if (!tcgResults || !Array.isArray(tcgResults.results)) return
        const updated = tcgResults.results.map(r => {
            if (!r?.ok) return r
            const d = r.data || {}
            if (d.source !== 'justtcg') return r
            const usd = Number(d.price)
            if (!isFinite(usd)) return r
            return {
                ...r,
                data: { ...d, price_vnd: Math.round(usd * rate) }
            }
        })
        setTcgResults({ ...tcgResults, results: updated })
    }

    // Normalize input: trim, uppercase, normalize unicode dashes to '-'
    const normalizePrintCode = (rawInput) => {
        const s = (rawInput || '').trim()
            .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-') // unicode dashes → '-'
            .replace(/\s+/g, ' ')
            .toUpperCase()
        return s
    }

    // Resolve print code via server to { id, name, exactSetCode }
    const resolveNameFromPrintCode = async (rawInput) => {
        const input = normalizePrintCode(rawInput)
        const r = await fetch(`${__API_URL__}/api/printcode/resolve?code=${encodeURIComponent(input)}`)
        if (!r.ok) throw new Error(`HTTP ${r.status} resolving ${input}`)
        const json = await r.json()
        if (!json?.ok || !json?.name) throw new Error('Không lấy được name từ server')
        return { id: json.id, name: json.name, exactSetCode: input }
    }

    const isPrintCode = (rawInput) => {
        const input = normalizePrintCode(rawInput)
        return /^([A-Z0-9]+-[A-Z]{2})-([0-9]{3})$/.test(input)
    }

    const fetchTCGCard = async (e) => {
        e?.preventDefault?.()
        if (!cardName.trim()) {
            setTcgError('Vui lòng nhập print code, có thể nhập nhiều mã, cách nhau bởi dấu phẩy')
            setTcgResults(null)
            return
        }
        setTcgLoading(true)
        setTcgError(null)
        try {
            // Support multiple codes separated by commas
            const codes = cardName.split(',').map(s => normalizePrintCode(s)).filter(Boolean)

            const allResults = []

            for (const code of codes) {
                // 1) Resolve via ygoresources
                let resolved = null
                try {
                    resolved = await resolveNameFromPrintCode(code)
                } catch (err) {
                    allResults.push({ ok: false, setcode: code, error: `Không thể tra mã in: ${String(err)}` })
                    continue
                }
                if (!resolved) {
                    allResults.push({ ok: false, setcode: code, error: 'Không tìm thấy thông tin cho mã đã nhập' })
                    continue
                }

                // 2) Query JustTCG by resolved name and map variants (prices) per matching card number/code
                const setcodeFilter = resolved.exactSetCode || code
                const jt = await fetch(`${__API_URL__}/api/justtcg/cards?name=${encodeURIComponent(resolved.name)}`)
                if (!jt.ok) {
                    allResults.push({ ok: true, setcode: setcodeFilter, data: { source: 'ygoresources', id: resolved.id, name: resolved.name, set_code: setcodeFilter } })
                    continue
                }
                const jtJson = await jt.json()

                // Fetch image once from YGOPRODeck by name (fname) and reuse for all variants
                let ygImageUrl = null
                try {
                    let imgRes = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(resolved.name)}&format=tcg`)
                    if (!imgRes.ok) {
                        imgRes = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(resolved.name)}&format=tcg`)
                    }
                    if (imgRes.ok) {
                        const imgJson = await imgRes.json()
                        const firstCard = Array.isArray(imgJson?.data) ? imgJson.data[0] : null
                        ygImageUrl = firstCard?.card_images?.[0]?.image_url || null
                    }
                } catch (_) { /* ignore image errors */ }

                // Expect jtJson.data to be an array of cards with variants and a number/code
                let pushedAny = false
                const results = Array.isArray(jtJson?.data) ? jtJson.data : []
                const setcodeUpper = setcodeFilter.toUpperCase()
                results.forEach(card => {
                    const cardName = String(card?.name || '').trim()
                    const numberLike = String(card?.number || '').toUpperCase()
                    const matchesCode = numberLike === setcodeUpper

                    if (!matchesCode) return

                    const baseRarity = card?.rarity || null
                    const variants = Array.isArray(card.variants) ? card.variants : []

                    if (variants.length === 0) {
                        // Push one row even if no variants present
                        allResults.push({
                            ok: true,
                            setcode: setcodeFilter,
                            data: {
                                source: 'justtcg',
                                id: resolved.id,
                                name: cardName || resolved.name,
                                set_code: setcodeFilter,
                                set_name: card?.set,
                                rarity: baseRarity,
                                price: null,
                                card_image: ygImageUrl
                            }
                        })
                        pushedAny = true
                        return
                    }

                    // Group variants by rarity+printing and keep the lowest price (avoid duplicate rows)
                    const groups = new Map()
                    variants.forEach(v => {
                        const printing = v?.printing || ''
                        const key = `${baseRarity || ''}|${printing}`
                        const price = typeof v?.price === 'number' ? v.price : Number.POSITIVE_INFINITY
                        const chosen = groups.get(key)
                        if (!chosen || price < chosen.price) {
                            groups.set(key, {
                                printing,
                                price,
                                sample: v // keep a sample for condition/language if needed
                            })
                        }
                    })

                    const rate = Number(tcgRate)
                    groups.forEach(g => {
                        const vnd = Number.isFinite(g.price) && Number.isFinite(rate) && rate > 0 ? Math.round(g.price * rate) : null
                        allResults.push({
                            ok: true,
                            setcode: setcodeFilter,
                            data: {
                                source: 'justtcg',
                                id: resolved.id,
                                name: cardName || resolved.name,
                                set_code: setcodeFilter,
                                set_name: card?.set,
                                rarity: baseRarity,
                                printing: g.printing,
                                condition: undefined,
                                language: g.sample?.language,
                                price: Number.isFinite(g.price) ? g.price : null,
                                price_vnd: vnd,
                                card_image: ygImageUrl
                            }
                        })
                        pushedAny = true
                    })
                })

                if (!pushedAny) {
                    allResults.push({ ok: true, setcode: setcodeFilter, data: { source: 'ygoresources', id: resolved.id, name: resolved.name, set_code: setcodeFilter } })
                }
            }

            setTcgResults({ results: allResults })
        } catch (err) {
            setTcgError(String(err))
            setTcgResults(null)
        } finally {
            setTcgLoading(false)
        }
    }

    const fetchInfo = async (e) => {
        e?.preventDefault?.()
        const codes = setcodes.split(',').map(s => s.trim()).filter(Boolean)
        if (codes.length === 0) {
            setAeError('Please enter at least one setcode, separated by commas.')
            setAeResults(null)
            return
        }
        setAeLoading(true)
        setAeError(null)
        try {
            const res = await fetch(`${__API_URL__}/api/cardsetsinfo?setcode=${encodeURIComponent(codes.join(','))}`)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const json = await res.json()

            // Process results to separate cards with different rarities
            const processedResults = []

            if (Array.isArray(json.results)) {
                json.results.forEach(result => {
                    if (result.ok && result.data?.source === 'tcg-corner' && result.data?.products) {
                        // Extract the searched setcode (e.g., "ALIN-AE002")
                        const searchedSetcode = result.setcode

                        // Filter products that match the searched setcode
                        const matchingProducts = result.data.products.filter(product => {
                            // Check if product title contains the searched setcode
                            return product.title.includes(searchedSetcode)
                        })

                        if (matchingProducts.length > 0) {
                            // Group matching products by card name (without rarity part)
                            const cardGroups = {}

                            matchingProducts.forEach(product => {
                                // Extract card name without rarity part (remove content in parentheses)
                                const cardNameMatch = product.title.match(/^(.+?)\s*\([^)]+\)$/)
                                const baseCardName = cardNameMatch ? cardNameMatch[1].trim() : product.title

                                if (!cardGroups[baseCardName]) {
                                    cardGroups[baseCardName] = []
                                }
                                cardGroups[baseCardName].push(product)
                            })

                            // Create separate result for each rarity, but with same base name
                            Object.entries(cardGroups).forEach(([baseCardName, products]) => {
                                // Extract all rarities for this card group
                                const allRarities = [...new Set(products.map(product => {
                                    const match = product.title.match(/\(([^)]+)\)/);
                                    return match ? match[1].trim() : 'Unknown';
                                }))];

                                // Group products by rarity
                                const rarityGroups = {};
                                products.forEach(product => {
                                    const match = product.title.match(/\(([^)]+)\)/);
                                    const rarity = match ? match[1].trim() : 'Unknown';

                                    if (!rarityGroups[rarity]) {
                                        rarityGroups[rarity] = [];
                                    }
                                    rarityGroups[rarity].push(product);
                                });

                                // Create one result per rarity
                                Object.entries(rarityGroups).forEach(([rarity, rarityProducts]) => {
                                    // Use the lowest price among products of this rarity
                                    const prices = rarityProducts.map(p => parseFloat(p.price) || 0).filter(p => p > 0);
                                    const minPrice = prices.length > 0 ? Math.min(...prices).toFixed(2) : 'N/A';

                                    const newResult = {
                                        ...result,
                                        data: {
                                            ...result.data,
                                            name: baseCardName, // Use base name without parentheses
                                            set_price: minPrice,
                                            rarity: rarity, // Single rarity per row
                                            allRarities: allRarities, // All rarities for this card
                                            products: rarityProducts // Only products of this rarity
                                        }
                                    }
                                    processedResults.push(newResult)
                                });
                            })
                        }
                    } else {
                        // Keep non-TCG Corner results as is
                        processedResults.push(result)
                    }
                })
            }

            setAeResults({ ...json, results: processedResults })
        } catch (err) {
            setAeError(String(err))
            setAeResults(null)
        } finally {
            setAeLoading(false)
        }
    }

    // Function to remove a row from results
    const removeRow = (index) => {
        const currentResults = activeTab === 'ae' ? aeResults : tcgResults
        if (!currentResults || !Array.isArray(currentResults.results)) return

        const updatedResults = currentResults.results.filter((_, i) => i !== index)

        if (activeTab === 'ae') {
            setAeResults({ ...currentResults, results: updatedResults })
        } else {
            setTcgResults({ ...currentResults, results: updatedResults })
        }
    }

    const exportToExcel = () => {
        const currentResults = activeTab === 'ae' ? aeResults : tcgResults
        if (!currentResults || !Array.isArray(currentResults.results) || currentResults.results.length === 0) {
            alert('Không có dữ liệu để export!')
            return
        }

        const normalized = currentResults.results
        // Precompute counts/rarities for Excel as well
        const excelTcgSetcodeCounts = (() => {
            const map = new Map()
            normalized.forEach(r => {
                const d0 = r?.data || {}
                if (d0?.source === 'justtcg' && d0?.set_code) {
                    map.set(d0.set_code, (map.get(d0.set_code) || 0) + 1)
                }
            })
            return map
        })()
        const excelTcgSetcodeRarities = (() => {
            const map = new Map()
            normalized.forEach(r => {
                const d0 = r?.data || {}
                if (d0?.source === 'justtcg' && d0?.set_code) {
                    const set = map.get(d0.set_code) || new Set()
                    if (d0.rarity) set.add(String(d0.rarity))
                    map.set(d0.set_code, set)
                }
            })
            return map
        })()
        const excelData = normalized.map((r, idx) => {
            if (!r.ok) {
                return {
                    'STT': idx + 1,
                    'Sản phẩm': `Lỗi: ${r.setcode}`,
                    'Mô tả': `${r.status ? `HTTP ${r.status}` : ''} ${r.error || '-'}`,
                    'Cột trống 1': '',
                    'Mã sản phẩm': '',
                    'Tên nhóm phân loại hàng 1': '',
                    'Tên phân loại hàng cho nhóm phân loại hàng 1': '',
                    'Hình ảnh mỗi phân loại': '',
                    'Cột trống 2': '',
                    'Cột trống 3': '',
                    'Cột trống 4': '',
                    'Giá': 'N/A',
                    'Cột trống 5': '',
                    'Cột trống 6': '',
                    'Cột trống 7': '',
                    'Cột trống 8': '',
                    'Hình ảnh': 'N/A'
                }
            }

            const d = r.data || {}
            const isTCGCorner = d.source === 'tcg-corner'
            const isYGOPRODeck = d.source === 'ygoprodeck'
            const isJustTCG = d.source === 'justtcg'

            if (isYGOPRODeck) {
                // YGOPRODeck TCG results
                const cardImage = d.card_images && d.card_images[0] ? d.card_images[0].image_url : null
                const descLines = [
                    '- Thẻ bài chính hãng Konami',
                    `- Tên thẻ bài: ${d.name}`,
                    `- Loại: ${d.type}`,
                    d.archetype ? `- Archetype: ${d.archetype}` : '',
                    // Add set information if available
                    d.setInfo ? `- Set: ${d.setInfo.set_name}` : '',
                    d.setInfo ? `- Set Code: ${d.setInfo.set_code}` : '',
                    d.setInfo ? `- Rarity: ${d.setInfo.set_rarity}` : ''
                ].filter(Boolean)

                const price = d.setInfo && d.setInfo.set_price
                    ? `$${d.setInfo.set_price}`
                    : d.ygoprodeck_url || 'N/A'

                const setCodeDisplay = d.setInfo ? ` - ${d.setInfo.set_code}` : ''

                return {
                    'STT': idx + 1,
                    'Sản phẩm': `Thẻ bài Yugioh! - ${d.name}${setCodeDisplay}`,
                    'Mô tả': descLines.join('\n'),
                    'Cột trống 1': '',
                    'Mã sản phẩm': '',
                    'Tên nhóm phân loại hàng 1': '',
                    'Tên phân loại hàng cho nhóm phân loại hàng 1': '',
                    'Hình ảnh mỗi phân loại': '',
                    'Cột trống 2': '',
                    'Cột trống 3': '',
                    'Giá': price,
                    'Cột trống 4': '',
                    'Cột trống 5': '',
                    'Cột trống 6': '',
                    'Cột trống 7': '',
                    'Cột trống 8': '',
                    'Hình ảnh': cardImage || 'Không có hình'
                }
            } else if (isTCGCorner) {
                // Convert rarity codes to full names
                const rarityMap = {
                    'N': 'Common',
                    'UR': 'Ultra Rare',
                    'SR': 'Super Rare',
                    'P-N': 'Normal Parallel',
                    'CR': 'Collector Rare',
                    'PSER': 'Prismatic Secret Rare',
                    'UL': 'Ultimate Rare',
                    'R': 'Rare',
                    'SER': 'Secret Rare',
                    'QCSR': 'QCSR'
                };

                // Get all rarities for this card (if available) or use current rarity
                const allRarities = d.allRarities || [d.rarity || 'Unknown'];
                const allRarityNames = allRarities.map(code => rarityMap[code] || code);
                const rarityDisplay = allRarityNames.join('/');

                const productImage = d.products && d.products[0] ? d.products[0].image : null
                const price = d.set_price !== 'N/A' ? `${d.set_price}` : 'N/A'

                // Check if this card has multiple rarities
                const hasMultipleRarities = allRarities.length > 1;

                // Extract product code from setcode (e.g., MP25-EN021 -> 21)
                const extractProductCode = (setcode) => {
                    if (!setcode) return '';
                    const match = setcode.match(/([A-Z0-9]+-[A-Z]{2})([0-9]{3})$/);
                    return match ? match[2] : '';
                };

                // Get current rarity name
                const currentRarityCode = d.rarity || 'Unknown';
                const currentRarityName = rarityMap[currentRarityCode] || currentRarityCode;

                return {
                    'STT': idx + 1,
                    'Sản phẩm': `Thẻ bài Yugioh! - ${d.name}`,
                    'Mô tả': `- Thẻ bài chính hãng Konami\n- Tên thẻ bài: ${d.name}\n- Condition: Mint / Near Mint\n- Rarity: ${rarityDisplay}\n- Set Code: ${d.set_code || '-'}`,
                    'Cột trống 1': '',
                    'Mã sản phẩm': hasMultipleRarities ? extractProductCode(d.set_code) : '',
                    'Tên nhóm phân loại hàng 1': hasMultipleRarities ? 'Rarity' : '',
                    'Tên phân loại hàng cho nhóm phân loại hàng 1': hasMultipleRarities ? currentRarityName : '',
                    'Hình ảnh mỗi phân loại': hasMultipleRarities ? (productImage || '') : '',
                    'Cột trống 2': '',
                    'Cột trống 3': '',
                    'Giá': price,
                    'Cột trống 4': '',
                    'Cột trống 5': '',
                    'Cột trống 6': '',
                    'Cột trống 7': '',
                    'Cột trống 8': '',
                    'Hình ảnh': productImage || 'Không có hình'
                }
            } else if (isJustTCG) {
                const isMultiRarityForSet = d.set_code && (excelTcgSetcodeCounts.get(d.set_code) || 0) > 1
                const extractProductCode = (setcode) => {
                    if (!setcode) return ''
                    const m = String(setcode).match(/(\d{3})$/)
                    return m ? m[1] : ''
                }
                const priceUsd = typeof d.price === 'number' ? d.price : (Number(d.price) || null)
                // Export without thousand separators; keep as raw number or simple string
                const price = d.price_vnd != null && isFinite(Number(d.price_vnd))
                    ? Number(d.price_vnd)
                    : (priceUsd != null ? priceUsd : '-')
                const baseName = isMultiRarityForSet ? String(d.name).replace(/\s*\([^)]*\)\s*$/, '').trim() : d.name
                const title = `Thẻ bài Yugioh! - ${baseName}${d.set_code ? ` - ${d.set_code}` : ''}`
                const descLines = [
                    '- Thẻ bài chính hãng Konami',
                    `- Tên thẻ bài: ${baseName}`,
                    d.set_name ? `- Set: ${d.set_name}` : '',
                    d.set_code ? `- Set Code: ${d.set_code}` : '',
                    isMultiRarityForSet
                        ? `- Rarity: ${Array.from(excelTcgSetcodeRarities.get(d.set_code) || []).join(' / ')}`
                        : `- Rarity: ${d.rarity || '-'}`,
                    '- Condition: Mint / Near Mint'
                ].filter(Boolean)

                return {
                    'STT': idx + 1,
                    'Sản phẩm': title,
                    'Mô tả': descLines.join('\n'),
                    'Cột trống 1': '',
                    'Mã sản phẩm': isMultiRarityForSet ? extractProductCode(d.set_code) : '',
                    'Tên nhóm phân loại hàng 1': isMultiRarityForSet ? 'Rarity' : '',
                    'Tên phân loại hàng cho nhóm phân loại hàng 1': isMultiRarityForSet ? (d.rarity || '-') : '',
                    'Hình ảnh mỗi phân loại': d.card_image || '',
                    'Cột trống 2': '',
                    'Cột trống 3': '',
                    'Giá': price,
                    'Cột trống 4': '',
                    'Cột trống 5': '',
                    'Cột trống 6': '',
                    'Cột trống 7': '',
                    'Cột trống 8': '',
                    'Hình ảnh': d.card_image || 'Không có hình'
                }
            } else if (d.source === 'tcg-corner-oos') {
                const productCode = d.set_code ? (d.set_code.match(/(\d{3})$/)?.[1] || '') : ''
                // Keep price raw number/string
                const price = d.set_price !== 'N/A' ? (isFinite(Number(d.set_price)) ? Number(d.set_price) : `${d.set_price}`) : 'N/A'
                return {
                    'STT': idx + 1,
                    'Sản phẩm': `Thẻ bài Yugioh! - ${d.name}${d.set_code ? ` - ${d.set_code}` : ''}`,
                    'Mô tả': [
                        '- Thẻ bài chính hãng Konami',
                        `- Tên thẻ bài: ${d.name}`,
                        d.set_code ? `- Set Code: ${d.set_code}` : '',
                        d.rarity ? `- Rarity: ${d.rarity}` : '',
                        '- Condition: Mint / Near Mint'
                    ].filter(Boolean).join('\n'),
                    'Cột trống 1': '',
                    'Mã sản phẩm': productCode,
                    'Tên nhóm phân loại hàng 1': 'Rarity',
                    'Tên phân loại hàng cho nhóm phân loại hàng 1': d.rarity || '-',
                    'Hình ảnh mỗi phân loại': d.image || '',
                    'Cột trống 2': '',
                    'Cột trống 3': '',
                    'Giá': price,
                    'Cột trống 4': '',
                    'Cột trống 5': '',
                    'Cột trống 6': '',
                    'Cột trống 7': '',
                    'Cột trống 8': '',
                    'Hình ảnh': d.image || 'Không có hình'
                }
            } else {
                const price = d.set_price ? `$${d.set_price}` : '-'
                return {
                    'STT': idx + 1,
                    'Sản phẩm': `Thẻ bài Yugioh! - ${d.name ?? '-'} - ${d.set_code ?? '-'}`,
                    'Mô tả': `- Thẻ bài chính hãng Konami\n- Tên thẻ bài: ${d.name ?? '-'}\n- Condition: Mint / Near Mint\n- Set: ${d.set_name ?? '-'}\n- Rarity: ${d.set_rarity ?? '-'}`,
                    'Cột trống 1': '',
                    'Mã sản phẩm': '',
                    'Tên nhóm phân loại hàng 1': '',
                    'Tên phân loại hàng cho nhóm phân loại hàng 1': '',
                    'Hình ảnh mỗi phân loại': '',
                    'Cột trống 2': '',
                    'Cột trống 3': '',
                    'Giá': price,
                    'Cột trống 4': '',
                    'Cột trống 5': '',
                    'Cột trống 6': '',
                    'Cột trống 7': '',
                    'Cột trống 8': '',
                    'Hình ảnh': 'Không có hình'
                }
            }
        })

        // Create workbook and worksheet
        const ws = XLSX.utils.json_to_sheet(excelData)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Yu-Gi-Oh Cards')

        // Set column widths
        const colWidths = [
            { wch: 5 },   // STT
            { wch: 50 },  // Sản phẩm
            { wch: 60 },  // Mô tả
            { wch: 5 },   // Cột trống 1
            { wch: 15 },  // Mã sản phẩm
            { wch: 25 },  // Tên nhóm phân loại hàng 1
            { wch: 30 },  // Tên phân loại hàng cho nhóm phân loại hàng 1
            { wch: 20 },  // Hình ảnh mỗi phân loại
            { wch: 5 },   // Cột trống 2
            { wch: 5 },   // Cột trống 3
            { wch: 15 },  // Giá
            { wch: 5 },   // Cột trống 4
            { wch: 5 },   // Cột trống 5
            { wch: 5 },   // Cột trống 6
            { wch: 5 },   // Cột trống 7
            { wch: 5 },   // Cột trống 8
            { wch: 20 }   // Hình ảnh
        ]
        ws['!cols'] = colWidths

        // Export file
        const fileName = `yugioh-cards-${new Date().toISOString().split('T')[0]}.xlsx`
        XLSX.writeFile(wb, fileName)
    }

    // Get current results based on active tab
    const currentResults = activeTab === 'ae' ? aeResults : tcgResults
    const currentLoading = activeTab === 'ae' ? aeLoading : tcgLoading
    const currentError = activeTab === 'ae' ? aeError : tcgError
    const normalized = Array.isArray(currentResults?.results) ? currentResults.results : []
    // Precompute counts and rarity sets of TCG rows per set_code to detect multi-rarity cases
    const tcgSetcodeCounts = (() => {
        const map = new Map()
        normalized.forEach(r => {
            const d = r?.data || {}
            if (d?.source === 'justtcg' && d?.set_code) {
                map.set(d.set_code, (map.get(d.set_code) || 0) + 1)
            }
        })
        return map
    })()
    const tcgSetcodeRarities = (() => {
        const map = new Map()
        normalized.forEach(r => {
            const d = r?.data || {}
            if (d?.source === 'justtcg' && d?.set_code) {
                const set = map.get(d.set_code) || new Set()
                if (d.rarity) set.add(String(d.rarity))
                map.set(d.set_code, set)
            }
        })
        return map
    })()

    return (
        <div className="app">
            <header className="header">
                <h1>Yu-Gi-Oh! Card Lookup</h1>
                <p className="subtitle">Search for Yu-Gi-Oh! cards by setcode (AE) or card name (TCG)</p>
            </header>

            {/* Tab Navigation */}
            <div className="tab-container">
                <button
                    className={`tab ${activeTab === 'ae' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ae')}
                >
                    AE Cards
                </button>
                <button
                    className={`tab ${activeTab === 'tcg' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tcg')}
                >
                    TCG Cards
                </button>
            </div>

            {/* AE Cards Form */}
            {activeTab === 'ae' && (
                <form className="search" onSubmit={fetchInfo}>
                    <div className="controls">
                        <input
                            id="setcodes"
                            className="input"
                            value={setcodes}
                            onChange={(e) => setSetcodes(e.target.value)}
                            placeholder="e.g. ALIN-AE002, DUAD-AE001"
                            autoComplete="off"
                        />
                        <button type="submit" className="button" disabled={aeLoading}>
                            {aeLoading ? 'Loading...' : 'Search'}
                        </button>
                    </div>
                    <div className="controls" style={{ marginTop: '8px' }}>
                        <input
                            id="aePriceExtra"
                            className="input"
                            style={{ maxWidth: '220px' }}
                            value={aePriceExtra}
                            onChange={(e) => setAePriceExtra(e.target.value)}
                            placeholder="Add price (bulk)"
                            autoComplete="off"
                            inputMode="decimal"
                        />
                        <button type="button" className="button" onClick={applyAeBulkPrice} style={{ marginLeft: '8px' }}>Update</button>

                    </div>
                    <div className="controls" style={{ marginTop: '8px' }}>
                        <button type="button" className="button" onClick={() => setShowOosSearch(v => !v)}>
                            {showOosSearch ? 'Ẩn tìm theo handle' : 'Tìm theo handle'}
                        </button>
                    </div>
                    {showOosSearch && (
                        <div className="controls" style={{ marginTop: '8px' }}>
                            <input
                                id="oosHandles"
                                className="input"
                                value={oosHandles}
                                onChange={(e) => setOosHandles(e.target.value)}
                                placeholder="[Mã card]-[rarity] Ví dụ: duad-ae062-ser, duad-ae062-u"
                                autoComplete="off"
                            />
                            <button type="button" className="button" onClick={async () => {
                                const handles = oosHandles.split(',').map(s => s.trim()).filter(Boolean)
                                if (handles.length === 0) return
                                setAeLoading(true)
                                setAeError(null)
                                try {
                                    const rows = []
                                    for (const h of handles) {
                                        const r = await fetch(`${__API_URL__}/api/tcg-corner/product?q=${encodeURIComponent(h)}`)
                                        if (!r.ok) {
                                            rows.push({ ok: false, setcode: h, status: r.status, error: 'Fetch product .js failed' })
                                            continue
                                        }
                                        const json = await r.json()
                                        const p = json?.product
                                        if (!p) {
                                            rows.push({ ok: false, setcode: h, error: 'Invalid product' })
                                            continue
                                        }
                                        // Try to infer set code and rarity from handle or title
                                        const handle = p.handle || ''
                                        const title = p.title || ''
                                        const matchCode = title.match(/([A-Z0-9]+-[A-Z]{2}\d{3})/i)
                                        const set_code = matchCode ? matchCode[1].toUpperCase() : ''
                                        const rarityMatch = title.match(/\(([^)]+)\)/)
                                        const rarity = rarityMatch ? rarityMatch[1] : ''
                                        rows.push({
                                            ok: true,
                                            setcode: set_code || h,
                                            data: {
                                                source: 'tcg-corner-oos',
                                                name: title.replace(/\s*\([^)]*\)\s*$/, ''),
                                                set_code,
                                                rarity,
                                                set_price: p.price || p.price_min || p.price_max || 'N/A',
                                                products: [p],
                                                image: p.image,
                                                sold_out: p.sold_out
                                            }
                                        })
                                    }
                                    // append to AE results table
                                    const prev = aeResults?.results || []
                                    setAeResults({ results: [...prev, ...rows] })
                                } catch (e) {
                                    setAeError(String(e))
                                } finally {
                                    setAeLoading(false)
                                }
                            }} style={{ marginLeft: '8px' }}>Fetch OOS</button>
                        </div>
                    )}
                    <p className="hint">Use commas to separate multiple set codes. Cards with "AE" will search TCG Corner.</p>
                </form>
            )}

            {/* TCG Cards Form */}
            {activeTab === 'tcg' && (
                <form className="search" onSubmit={fetchTCGCard}>
                    <div className="controls">
                        <input
                            id="cardName"
                            className="input"
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value)}
                            placeholder="VD: MP25-EN021, MP25-EN025"
                            autoComplete="off"
                        />
                        <button type="submit" className="button" disabled={tcgLoading}>
                            {tcgLoading ? 'Loading...' : 'Search'}
                        </button>
                    </div>
                    <div className="controls" style={{ marginTop: '8px' }}>
                        <input
                            id="tcgRate"
                            className="input"
                            style={{ maxWidth: '220px' }}
                            value={tcgRate}
                            onChange={(e) => setTcgRate(e.target.value)}
                            placeholder="USD → VND rate (e.g. 25000)"
                            autoComplete="off"
                            inputMode="numeric"
                        />
                        <button type="button" className="button" onClick={applyTcgRate} style={{ marginLeft: '8px' }}>Apply</button>
                    </div>
                    <p className="hint">Enter one or multiple print codes, separated by commas.</p>
                </form>
            )}

            {currentError && (
                <div className="alert error">
                    <span>⚠️ {currentError}</span>
                </div>
            )}

            {!currentError && !currentLoading && normalized.length > 0 && (
                <section>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0 0 0' }}>
                        <h2 className="card-title">
                            Results ({normalized.length})
                        </h2>
                        <button
                            onClick={exportToExcel}
                            className="button"
                            style={{
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            📊 Export Excel
                        </button>
                    </div>

                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Sản phẩm</th>
                                    <th>Mô tả</th>
                                    <th>Mã sản phẩm</th>
                                    <th>Tên nhóm phân loại hàng 1</th>
                                    <th>Tên phân loại hàng cho nhóm phân loại hàng 1</th>
                                    <th>Hình ảnh mỗi phân loại</th>
                                    <th>Giá</th>
                                    <th>Hình ảnh</th>
                                    <th>Xóa</th>
                                </tr>
                            </thead>
                            <tbody>
                                {normalized.map((r, idx) => {
                                    if (!r.ok) {
                                        return (
                                            <tr key={idx}>
                                                <td colSpan={8} className="error-row">
                                                    <span>Query: <span className="field-value code">{r.setcode}</span></span>
                                                    <br />
                                                    <span>Lỗi: {r.status ? `HTTP ${r.status}` : ''} {r.error || '-'}</span>
                                                </td>
                                                <td>
                                                    <button
                                                        onClick={() => removeRow(idx)}
                                                        className="button"
                                                        style={{
                                                            backgroundColor: '#dc3545',
                                                            color: 'white',
                                                            border: 'none',
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '12px'
                                                        }}
                                                        title="Xóa dòng này"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    }

                                    const d = r.data || {}
                                    const isTCGCorner = d.source === 'tcg-corner'
                                    const isYGOPRODeck = d.source === 'ygoprodeck'
                                    const isJustTCG = d.source === 'justtcg'

                                    if (isYGOPRODeck) {
                                        // Display YGOPRODeck TCG results
                                        const setCodeDisplay = d.setInfo ? ` - ${d.setInfo.set_code}` : ''
                                        const title = `Thẻ bài Yugioh! - ${d.name}${setCodeDisplay}`
                                        const descLines = [
                                            '- Thẻ bài chính hãng Konami',
                                            `- Tên thẻ bài: ${d.name}`,
                                            `- Loại: ${d.type}`,
                                            d.archetype ? `- Archetype: ${d.archetype}` : '',
                                            // Add set information if available
                                            d.setInfo ? `- Set: ${d.setInfo.set_name}` : '',
                                            d.setInfo ? `- Set Code: ${d.setInfo.set_code}` : '',
                                            d.setInfo ? `- Rarity: ${d.setInfo.set_rarity}` : ''
                                        ].filter(Boolean)

                                        // Get image from card_images
                                        const cardImage = d.card_images && d.card_images[0] ? d.card_images[0].image_url : null

                                        // Display price from set info or YGOPRODeck link
                                        const priceDisplay = d.setInfo && d.setInfo.set_price
                                            ? `$${d.setInfo.set_price}`
                                            : <a
                                                href={d.ygoprodeck_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: '#007bff', textDecoration: 'none' }}
                                            >
                                                Xem trên YGOPRODeck
                                            </a>

                                        return (
                                            <tr key={idx}>
                                                <td>{title}</td>
                                                <td>
                                                    {descLines.map((line, i) => (
                                                        <div key={i}>{line}</div>
                                                    ))}
                                                </td>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td className="price-cell">
                                                    {priceDisplay}
                                                </td>
                                                <td className="image-cell">
                                                    {cardImage ? (
                                                        <img
                                                            src={cardImage}
                                                            alt={d.name}
                                                            style={{
                                                                maxWidth: '100px',
                                                                maxHeight: '100px',
                                                                objectFit: 'contain',
                                                                border: '1px solid #ddd',
                                                                borderRadius: '4px'
                                                            }}
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                                e.target.nextSibling.style.display = 'block';
                                                            }}
                                                        />
                                                    ) : null}
                                                    {!cardImage && (
                                                        <span style={{ color: '#666', fontSize: '12px' }}>Không có hình</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <button
                                                        onClick={() => removeRow(idx)}
                                                        className="button"
                                                        style={{
                                                            backgroundColor: '#dc3545',
                                                            color: 'white',
                                                            border: 'none',
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '12px'
                                                        }}
                                                        title="Xóa dòng này"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    } else if (isTCGCorner) {
                                        // Display TCG Corner results
                                        const title = `Thẻ bài Yugioh! - ${d.name}`

                                        // Convert rarity codes to full names
                                        const rarityMap = {
                                            'N': 'Common',
                                            'UR': 'Ultra Rare',
                                            'SR': 'Super Rare',
                                            'P-N': 'Normal Parallel',
                                            'CR': 'Collector Rare',
                                            'PSER': 'Prismatic Secret Rare',
                                            'UL': 'Ultimate Rare',
                                            'R': 'Rare',
                                            'SER': 'Secret Rare',
                                            'QCSR': 'QCSR'
                                        };

                                        // Get all rarities for this card (if available) or use current rarity
                                        const allRarities = d.allRarities || [d.rarity || 'Unknown'];
                                        const allRarityNames = allRarities.map(code => rarityMap[code] || code);
                                        const rarityDisplay = allRarityNames.join('/');

                                        // Check if this card has multiple rarities
                                        const hasMultipleRarities = allRarities.length > 1;

                                        // Extract product code from setcode (e.g., MP25-EN021 -> 21)
                                        const extractProductCode = (setcode) => {
                                            if (!setcode) return '';
                                            const match = setcode.match(/([A-Z0-9]+-[A-Z]{2})([0-9]{3})$/);
                                            return match ? match[2] : '';
                                        };

                                        // Get current rarity name
                                        const currentRarityCode = d.rarity || 'Unknown';
                                        const currentRarityName = rarityMap[currentRarityCode] || currentRarityCode;

                                        const descLines = [
                                            '- Thẻ bài chính hãng Konami',
                                            `- Tên thẻ bài: ${d.name}`,
                                            '- Condition: Mint / Near Mint',
                                            `- Rarity: ${rarityDisplay}`,
                                            `- Set Code: ${d.set_code || '-'}`
                                        ]
                                        const price = d.set_price !== 'N/A' ? `${d.set_price}` : 'N/A'

                                        // Get image from first product
                                        const productImage = d.products && d.products[0] ? d.products[0].image : null

                                        return (
                                            <tr key={idx}>
                                                <td>{title}</td>
                                                <td>
                                                    {descLines.map((line, i) => (
                                                        <div key={i}>{line}</div>
                                                    ))}
                                                </td>
                                                <td>{hasMultipleRarities ? extractProductCode(d.set_code) : ''}</td>
                                                <td>{hasMultipleRarities ? 'Rarity' : ''}</td>
                                                <td>{hasMultipleRarities ? currentRarityName : ''}</td>
                                                <td className="image-cell">
                                                    {hasMultipleRarities && productImage ? (
                                                        <img
                                                            src={productImage}
                                                            alt={d.name}
                                                            style={{
                                                                maxWidth: '80px',
                                                                maxHeight: '80px',
                                                                objectFit: 'contain',
                                                                border: '1px solid #ddd',
                                                                borderRadius: '4px'
                                                            }}
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                                e.target.nextSibling.style.display = 'block';
                                                            }}
                                                        />
                                                    ) : null}
                                                    {hasMultipleRarities && !productImage && (
                                                        <span style={{ color: '#666', fontSize: '10px' }}>Không có hình</span>
                                                    )}
                                                </td>
                                                <td className="price-cell">{price}</td>
                                                <td className="image-cell">
                                                    {productImage ? (
                                                        <img
                                                            src={productImage}
                                                            alt={d.name}
                                                            style={{
                                                                maxWidth: '100px',
                                                                maxHeight: '100px',
                                                                objectFit: 'contain',
                                                                border: '1px solid #ddd',
                                                                borderRadius: '4px'
                                                            }}
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                                e.target.nextSibling.style.display = 'block';
                                                            }}
                                                        />
                                                    ) : null}
                                                    {!productImage && (
                                                        <span style={{ color: '#666', fontSize: '12px' }}>Không có hình</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <button
                                                        onClick={() => removeRow(idx)}
                                                        className="button"
                                                        style={{
                                                            backgroundColor: '#dc3545',
                                                            color: 'white',
                                                            border: 'none',
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '12px'
                                                        }}
                                                        title="Xóa dòng này"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    } else if (isJustTCG) {
                                        const isMultiRarityForSet = d.set_code && (tcgSetcodeCounts.get(d.set_code) || 0) > 1
                                        const extractProductCode = (setcode) => {
                                            if (!setcode) return ''
                                            const m = String(setcode).match(/(\d{3})$/)
                                            return m ? m[1] : ''
                                        }
                                        // Remove trailing rarity in parentheses if multi-rarity
                                        const baseName = isMultiRarityForSet ? String(d.name).replace(/\s*\([^)]*\)\s*$/, '').trim() : d.name
                                        const title = `Thẻ bài Yugioh! - ${baseName} - ${d.set_code || ''}`
                                        // Mô tả giống nhau giữa các dòng
                                        const descLines = [
                                            '- Thẻ bài chính hãng Konami',
                                            `- Tên thẻ bài: ${baseName}`,
                                            d.set_name ? `- Set: ${d.set_name}` : '',
                                            d.set_code ? `- Set Code: ${d.set_code}` : '',
                                            isMultiRarityForSet
                                                ? `- Rarity: ${Array.from(tcgSetcodeRarities.get(d.set_code) || []).join(' / ')}`
                                                : `- Rarity: ${d.rarity || '-'}`,
                                            '- Condition: Mint / Near Mint'
                                        ].filter(Boolean)
                                        const price = typeof d.price === 'number' ? `$${d.price}` : (d.price || '-')
                                        const cardImage = d.card_image || null

                                        return (
                                            <tr key={idx}>
                                                <td>{title}</td>
                                                <td>
                                                    {descLines.map((line, i) => (
                                                        <div key={i}>{line}</div>
                                                    ))}
                                                </td>
                                                <td>{isMultiRarityForSet ? extractProductCode(d.set_code) : ''}</td>
                                                <td>{isMultiRarityForSet ? 'Rarity' : ''}</td>
                                                <td>{isMultiRarityForSet ? (d.rarity || '-') : ''}</td>
                                                <td className="image-cell">
                                                    {cardImage ? (
                                                        <img
                                                            src={cardImage}
                                                            alt={d.name}
                                                            style={{
                                                                maxWidth: '80px',
                                                                maxHeight: '80px',
                                                                objectFit: 'contain',
                                                                border: '1px solid #ddd',
                                                                borderRadius: '4px'
                                                            }}
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                                e.target.nextSibling.style.display = 'block';
                                                            }}
                                                        />
                                                    ) : (
                                                        <span style={{ color: '#666', fontSize: '10px' }}>Không có hình</span>
                                                    )}
                                                </td>
                                                <td className="price-cell">{price}</td>
                                                <td className="image-cell">
                                                    {cardImage ? (
                                                        <img
                                                            src={cardImage}
                                                            alt={d.name}
                                                            style={{
                                                                maxWidth: '100px',
                                                                maxHeight: '100px',
                                                                objectFit: 'contain',
                                                                border: '1px solid #ddd',
                                                                borderRadius: '4px'
                                                            }}
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                                e.target.nextSibling.style.display = 'block';
                                                            }}
                                                        />
                                                    ) : (
                                                        <span style={{ color: '#666', fontSize: '12px' }}>Không có hình</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <button
                                                        onClick={() => removeRow(idx)}
                                                        className="button"
                                                        style={{
                                                            backgroundColor: '#dc3545',
                                                            color: 'white',
                                                            border: 'none',
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '12px'
                                                        }}
                                                        title="Xóa dòng này"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    } else if (d.source === 'tcg-corner-oos') {
                                        const title = `Thẻ bài Yugioh! - ${d.name}`
                                        const descLines = [
                                            '- Thẻ bài chính hãng Konami',
                                            `- Tên thẻ bài: ${d.name}`,
                                            d.set_code ? `- Set Code: ${d.set_code}` : '',
                                            d.rarity ? `- Rarity: ${d.rarity}` : '',
                                            '- Condition: Mint / Near Mint'
                                        ].filter(Boolean)
                                        const productCode = d.set_code ? (d.set_code.match(/(\d{3})$/)?.[1] || '') : ''
                                        const price = d.set_price !== 'N/A' ? `${d.set_price}` : 'N/A'
                                        const productImage = d.image || d.products?.[0]?.image || ''

                                        return (
                                            <tr key={idx}>
                                                <td>{title}</td>
                                                <td>
                                                    {descLines.map((line, i) => (
                                                        <div key={i}>{line}</div>
                                                    ))}
                                                </td>
                                                <td>{productCode}</td>
                                                <td>Rarity</td>
                                                <td>{d.rarity || '-'}</td>
                                                <td className="image-cell">
                                                    {productImage ? (
                                                        <img
                                                            src={productImage}
                                                            alt={d.name}
                                                            style={{
                                                                maxWidth: '80px',
                                                                maxHeight: '80px',
                                                                objectFit: 'contain',
                                                                border: '1px solid #ddd',
                                                                borderRadius: '4px'
                                                            }}
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                                e.target.nextSibling.style.display = 'block';
                                                            }}
                                                        />
                                                    ) : (
                                                        <span style={{ color: '#666', fontSize: '10px' }}>Không có hình</span>
                                                    )}
                                                </td>
                                                <td className="price-cell">{price}</td>
                                                <td className="image-cell">
                                                    {productImage ? (
                                                        <img
                                                            src={productImage}
                                                            alt={d.name}
                                                            style={{
                                                                maxWidth: '100px',
                                                                maxHeight: '100px',
                                                                objectFit: 'contain',
                                                                border: '1px solid #ddd',
                                                                borderRadius: '4px'
                                                            }}
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                                e.target.nextSibling.style.display = 'block';
                                                            }}
                                                        />
                                                    ) : (
                                                        <span style={{ color: '#666', fontSize: '12px' }}>Không có hình</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <button
                                                        onClick={() => removeRow(idx)}
                                                        className="button"
                                                        style={{
                                                            backgroundColor: '#dc3545',
                                                            color: 'white',
                                                            border: 'none',
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '12px'
                                                        }}
                                                        title="Xóa dòng này"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    } else {
                                        // Display YGOProDeck results (original logic)
                                        const title = `Thẻ bài Yugioh! - ${d.name ?? '-'} - ${d.set_code ?? '-'}`
                                        const descLines = [
                                            '- Thẻ bài chính hãng Konami',
                                            `- Tên thẻ bài: ${d.name ?? '-'}`,
                                            '- Condition: Mint / Near Mint',
                                            `- Set: ${d.set_name ?? '-'}`,
                                            `- Rarity: ${d.set_rarity ?? '-'}`
                                        ]
                                        const price = d.set_price ? `$${d.set_price}` : '-'

                                        return (
                                            <tr key={idx}>
                                                <td>{title}</td>
                                                <td>
                                                    {descLines.map((line, i) => (
                                                        <div key={i}>{line}</div>
                                                    ))}
                                                </td>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td className="price-cell">{price}</td>
                                                <td className="image-cell">
                                                    <span style={{ color: '#666', fontSize: '12px' }}>Không có hình</span>
                                                </td>
                                                <td>
                                                    <button
                                                        onClick={() => removeRow(idx)}
                                                        className="button"
                                                        style={{
                                                            backgroundColor: '#dc3545',
                                                            color: 'white',
                                                            border: 'none',
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '12px'
                                                        }}
                                                        title="Xóa dòng này"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    }
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {!currentError && !currentLoading && normalized.length === 0 && (
                <div className="placeholder">
                    <p>
                        {activeTab === 'ae'
                            ? 'Enter setcodes and click Fetch to see details.'
                            : 'Enter a card name and click Search to see details.'
                        }
                    </p>
                </div>
            )}
        </div>
    )
}

export default App