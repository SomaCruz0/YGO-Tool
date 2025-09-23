import React from 'react'

function AEForm({
    setcodes,
    setSetcodes,
    aePriceExtra,
    setAePriceExtra,
    showOosSearch,
    setShowOosSearch,
    oosHandles,
    setOosHandles,
    aeLoading,
    onSubmit,
    onApplyBulkPrice,
    onFetchOos
}) {
    return (
        <form className="search" onSubmit={onSubmit}>
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
                <button type="button" className="button" onClick={onApplyBulkPrice} style={{ marginLeft: '8px' }}>Update</button>
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
                    <button type="button" className="button" onClick={onFetchOos} style={{ marginLeft: '8px' }}>Fetch OOS</button>
                </div>
            )}
            <p className="hint">Use commas to separate multiple set codes. Cards with "AE" will search TCG Corner.</p>
        </form>
    )
}

export default AEForm


