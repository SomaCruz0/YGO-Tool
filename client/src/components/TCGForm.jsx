import React from 'react'

function TCGForm({
    cardName,
    setCardName,
    tcgRate,
    setTcgRate,
    tcgLoading,
    onSubmit,
    onApplyRate
}) {
    return (
        <form className="search" onSubmit={onSubmit}>
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
                <button type="button" className="button" onClick={onApplyRate} style={{ marginLeft: '8px' }}>Apply</button>
            </div>
            <p className="hint">Enter one or multiple print codes, separated by commas.</p>
        </form>
    )
}

export default TCGForm


