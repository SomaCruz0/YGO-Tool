import React from 'react'

function ResultsTable({ normalized, removeRow, tcgSetcodeCounts, tcgSetcodeRarities }) {
    return (
        <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0 0 0' }}>
                <h2 className="card-title">
                    Results ({normalized.length})
                </h2>
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
                                const setCodeDisplay = d.setInfo ? ` - ${d.setInfo.set_code}` : ''
                                const title = `Thẻ bài Yugioh! - ${d.name}${setCodeDisplay}`
                                const descLines = [
                                    '- Thẻ bài chính hãng Konami',
                                    `- Tên thẻ bài: ${d.name}`,
                                    `- Loại: ${d.type}`,
                                    d.archetype ? `- Archetype: ${d.archetype}` : '',
                                    d.setInfo ? `- Set: ${d.setInfo.set_name}` : '',
                                    d.setInfo ? `- Set Code: ${d.setInfo.set_code}` : '',
                                    d.setInfo ? `- Rarity: ${d.setInfo.set_rarity}` : ''
                                ].filter(Boolean)
                                const cardImage = d.card_images && d.card_images[0] ? d.card_images[0].image_url : null
                                const priceDisplay = d.setInfo && d.setInfo.set_price
                                    ? `$${d.setInfo.set_price}`
                                    : <a href={d.ygoprodeck_url} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'none' }}>Xem trên YGOPRODeck</a>
                                return (
                                    <tr key={idx}>
                                        <td>{title}</td>
                                        <td>{descLines.map((line, i) => (<div key={i}>{line}</div>))}</td>
                                        <td></td>
                                        <td></td>
                                        <td></td>
                                        <td></td>
                                        <td className="price-cell">{priceDisplay}</td>
                                        <td className="image-cell">
                                            {cardImage ? (
                                                <img src={cardImage} alt={d.name} style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'contain', border: '1px solid #ddd', borderRadius: '4px' }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                                            ) : null}
                                            {!cardImage && (<span style={{ color: '#666', fontSize: '12px' }}>Không có hình</span>)}
                                        </td>
                                        <td>
                                            <button onClick={() => removeRow(idx)} className="button" style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} title="Xóa dòng này">🗑️</button>
                                        </td>
                                    </tr>
                                )
                            }

                            if (isTCGCorner) {
                                const rarityMap = { 'N': 'Common', 'UR': 'Ultra Rare', 'SR': 'Super Rare', 'P-N': 'Normal Parallel', 'CR': 'Collector Rare', 'PSER': 'Prismatic Secret Rare', 'UL': 'Ultimate Rare', 'R': 'Rare', 'SER': 'Secret Rare', 'QCSR': 'QCSR' }
                                const allRarities = d.allRarities || [d.rarity || 'Unknown']
                                const rarityDisplay = allRarities.map(code => rarityMap[code] || code).join('/')
                                const extractProductCode = (setcode) => {
                                    if (!setcode) return ''
                                    const match = setcode.match(/([A-Za-z0-9]+-[A-Za-z]{2})([0-9]{3})$/i)
                                    return match ? match[2] : ''
                                }
                                const currentRarityName = (rarityMap[d.rarity] || d.rarity || 'Unknown')
                                const price = d.set_price !== 'N/A' ? `${d.set_price}` : 'N/A'
                                const productImage = d.products && d.products[0] ? d.products[0].image : null
                                const hasMultipleRarities = allRarities.length > 1
                                return (
                                    <tr key={idx}>
                                        <td>{`Thẻ bài Yugioh! - ${d.name}`}</td>
                                        <td>{[
                                            '- Thẻ bài chính hãng Konami',
                                            `- Tên thẻ bài: ${d.name}`,
                                            '- Condition: Mint / Near Mint',
                                            `- Rarity: ${rarityDisplay}`,
                                            `- Set Code: ${d.set_code || '-'}`
                                        ].map((l, i) => (<div key={i}>{l}</div>))}</td>
                                        <td>{hasMultipleRarities ? extractProductCode(d.set_code) : ''}</td>
                                        <td>{hasMultipleRarities ? 'Rarity' : ''}</td>
                                        <td>{hasMultipleRarities ? currentRarityName : ''}</td>
                                        <td className="image-cell">
                                            {hasMultipleRarities && productImage ? (
                                                <img src={productImage} alt={d.name} style={{ maxWidth: '80px', maxHeight: '80px', objectFit: 'contain', border: '1px solid #ddd', borderRadius: '4px' }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                                            ) : null}
                                            {hasMultipleRarities && !productImage && (<span style={{ color: '#666', fontSize: '10px' }}>Không có hình</span>)}
                                        </td>
                                        <td className="price-cell">{price}</td>
                                        <td className="image-cell">
                                            {productImage ? (
                                                <img src={productImage} alt={d.name} style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'contain', border: '1px solid #ddd', borderRadius: '4px' }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                                            ) : null}
                                            {!productImage && (<span style={{ color: '#666', fontSize: '12px' }}>Không có hình</span>)}
                                        </td>
                                        <td>
                                            <button onClick={() => removeRow(idx)} className="button" style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} title="Xóa dòng này">🗑️</button>
                                        </td>
                                    </tr>
                                )
                            }

                            if (isJustTCG) {
                                const isMultiRarityForSet = d.set_code && (tcgSetcodeCounts.get(d.set_code) || 0) > 1
                                const extractProductCode = (setcode) => {
                                    if (!setcode) return ''
                                    const m = String(setcode).match(/(\d{3})$/i)
                                    return m ? m[1] : ''
                                }
                                const baseName = isMultiRarityForSet ? String(d.name).replace(/\s*\([^)]*\)\s*$/, '').trim() : d.name
                                const title = `Thẻ bài Yugioh! - ${baseName} - ${d.set_code || ''}`
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
                                        <td>{descLines.map((line, i) => (<div key={i}>{line}</div>))}</td>
                                        <td>{isMultiRarityForSet ? extractProductCode(d.set_code) : ''}</td>
                                        <td>{isMultiRarityForSet ? 'Rarity' : ''}</td>
                                        <td>{isMultiRarityForSet ? (d.rarity || '-') : ''}</td>
                                        <td className="image-cell">
                                            {cardImage ? (
                                                <img src={cardImage} alt={d.name} style={{ maxWidth: '80px', maxHeight: '80px', objectFit: 'contain', border: '1px solid #ddd', borderRadius: '4px' }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                                            ) : (
                                                <span style={{ color: '#666', fontSize: '10px' }}>Không có hình</span>
                                            )}
                                        </td>
                                        <td className="price-cell">{price}</td>
                                        <td className="image-cell">
                                            {cardImage ? (
                                                <img src={cardImage} alt={d.name} style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'contain', border: '1px solid #ddd', borderRadius: '4px' }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                                            ) : (
                                                <span style={{ color: '#666', fontSize: '12px' }}>Không có hình</span>
                                            )}
                                        </td>
                                        <td>
                                            <button onClick={() => removeRow(idx)} className="button" style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} title="Xóa dòng này">🗑️</button>
                                        </td>
                                    </tr>
                                )
                            }

                            // Default
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
                                    <td>{descLines.map((line, i) => (<div key={i}>{line}</div>))}</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td className="price-cell">{price}</td>
                                    <td className="image-cell"><span style={{ color: '#666', fontSize: '12px' }}>Không có hình</span></td>
                                    <td>
                                        <button onClick={() => removeRow(idx)} className="button" style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} title="Xóa dòng này">🗑️</button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    )
}

export default ResultsTable


