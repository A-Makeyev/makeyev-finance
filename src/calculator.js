(function () {
    const form = document.getElementById('mortgage-form')
    const tracksList = document.getElementById('tracks-list')
    const formError = document.getElementById('form-error')
    const expandScheduleButton = document.getElementById('expand-schedule')
    const resultsLayout = document.querySelector('.results-layout')
    const startingAmountInput = document.getElementById('starting-amount')
    const termYearsInput = document.getElementById('term-years')
    const currency = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })
    const maximumTracks = 3
    const maximumYears = 30
    const thumbSize = 22
    const trackNames = { 1: 'מסלול אחד', 2: 'שני מסלולים', 3: 'שלושה מסלולים' }
    const fallbackInflation = 0.025
    let selectedYears = Number(termYearsInput.value) || 30
    let scheduleExpanded = false
    let startingPointDirty = false
    
    const trackTypes = {
        prime: 'פריים', 
        fixed: 'קבועה לא צמודה', 
        variable: 'משתנה לא צמודה', 
        fixedIndexed: 'קבועה צמודה למדד', 
        variableIndexed: 'משתנה צמודה למדד'
    }
    
    const presets = {
        basket1: [{ type: 'fixed', share: 1, rate: 4.5 }],
        basket2: [{ type: 'fixed', share: 1 / 3, rate: 4.5 }, { type: 'prime', share: 1 / 3, rate: 4.8 }, { type: 'variableIndexed', share: 1 / 3, rate: 4.2 }],
        basket3: [{ type: 'fixed', share: 1 / 2, rate: 4.5 }, { type: 'prime', share: 1 / 2, rate: 4.8 }]
    }

    function formatAmountInput(input) {
        const cursor = input.selectionStart
        const digitsBeforeCursor = input.value.slice(0, cursor).replace(/[^0-9.]/g, '').length
        let numericValue = input.value.replace(/[^0-9.]/g, '')
        if (!numericValue) {
            input.value = ''
            return
        }
        const firstDot = numericValue.indexOf('.')
        if (firstDot !== -1) numericValue = numericValue.slice(0, firstDot + 1) + numericValue.slice(firstDot + 1).replace(/\./g, '')
        const [integerPart, decimalPart] = numericValue.split('.')
        const formattedInteger = integerPart ? Number(integerPart).toLocaleString('en-US') : '0'
        input.value = decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger
        if (document.activeElement !== input || cursor === null) return
        let counted = 0
        let position = input.value.length
        for (let index = 0; index < input.value.length; index++) {
            if (/[0-9.]/.test(input.value[index])) counted++
            if (counted >= digitsBeforeCursor) {
                position = index + 1
                break
            }
        }
        input.setSelectionRange(position, position)
    }

    function getStartingAmount() {
        return Number(startingAmountInput.value.replace(/[,\s]/g, '')) || 0
    }

    function getTrackAmount(track) {
        return Number(track.querySelector('.track-amount').value.replace(/[₪,\s]/g, '')) || 0
    }

    function setTrackAmount(track, amount) {
        track.querySelector('.track-amount').value = amount > 0 ? Math.round(amount).toLocaleString('en-US') : ''
    }

    function distributeTrackAmounts() {
        const tracks = [...tracksList.children]
        const startingAmount = getStartingAmount()
        if (!tracks.length || !startingAmount) return
        let allocated = 0
        tracks.forEach((track, index) => {
            const amount = index === tracks.length - 1 ? startingAmount - allocated : Math.floor(startingAmount / tracks.length)
            setTrackAmount(track, amount)
            allocated += amount
        })
    }

    function scaleTrackAmounts() {
        const tracks = [...tracksList.children]
        const startingAmount = getStartingAmount()
        const currentTotal = tracks.reduce((sum, track) => sum + getTrackAmount(track), 0)
        if (!tracks.length || !startingAmount || !currentTotal) return
        let allocated = 0
        tracks.forEach((track, index) => {
            const amount = index === tracks.length - 1
                ? startingAmount - allocated
                : Math.round(startingAmount * getTrackAmount(track) / currentTotal)
            setTrackAmount(track, amount)
            allocated += amount
        })
    }

    function syncStartingAmountFromTracks() {
        const total = [...tracksList.children].reduce((sum, track) => sum + getTrackAmount(track), 0)
        startingAmountInput.value = total > 0 ? Math.round(total).toLocaleString('en-US') : ''
    }

    function updateTermSlider() {
        selectedYears = Number(termYearsInput.value) || 30
        
        const label = document.getElementById('total-payment-label')
        const labelText = selectedYears === 1
            ? 'סך ההחזר לשנה'
            : `סך ההחזר ל-<span class="term-years-value">${selectedYears}</span> שנים`
        label.innerHTML = `<span class="total-payment-text">${labelText}</span>`
        
        // In RTL the range runs right-to-left, so the fill starts at the right edge.
        // The thumb center travels only between thumbSize/2 and width - thumbSize/2,
        // hence the fill stop is corrected by half a thumb on both ends.
        const ratio = (selectedYears - 1) / (maximumYears - 1)
        const width = termYearsInput.offsetWidth || 0
        const thumbShare = width > 0 ? Math.min(1, thumbSize / width) : 0
        const percent = ((ratio * (1 - thumbShare)) + thumbShare / 2) * 100
        termYearsInput.style.background = `linear-gradient(to left, var(--calc-accent) 0%, var(--calc-accent) ${percent}%, var(--calc-line) ${percent}%, var(--calc-line) 100%)`
    }

    function applySelectedYears() {
        tracksList.querySelectorAll('.track-years').forEach(input => {
            input.value = selectedYears
        })
    }

    function constrainTrackYears(input) {
        const digits = input.value.replace(/[^0-9]/g, '')
        if (!digits) {
            input.value = ''
            return
        }
        let years = Number(digits)
        if (years > maximumYears) years = maximumYears
        if (years < 1) years = 1
        input.value = String(years)
    }

    function syncTermSliderFromTracks() {
        const yearsValues = [...tracksList.children]
            .map(track => Number(track.querySelector('.track-years').value))
            .filter(value => Number.isFinite(value) && value >= 1)
        if (!yearsValues.length) return
        const maxYears = Math.min(maximumYears, Math.max(...yearsValues))
        if (maxYears === selectedYears) return
        selectedYears = maxYears
        termYearsInput.value = String(maxYears)
        updateTermSlider()
    }

    function addTrack(values = {}) {
        const track = document.createElement('fieldset')
        track.className = 'mortgage-track'
        const displayAmount = values.amount === undefined || values.amount === '' ? '' : Number(values.amount).toLocaleString('en-US')
        track.innerHTML = `<legend>מסלול ${tracksList.children.length + 1}</legend>
            <button class="remove-track" type="button" aria-label="הסר מסלול">×</button>
            <label class="input-group">סוג מסלול<select class="track-type">${Object.entries(trackTypes).map(([value, label]) => `<option value="${value}" ${value === (values.type || 'fixed') ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
            <label class="input-group">סכום<div class="input-wrap"><input class="track-amount" type="text" inputmode="decimal" value="${displayAmount}" required><span></span></div></label>
            <label class="input-group">תקופה<div class="input-wrap"><input class="track-years" type="text" inputmode="numeric" min="1" max="${maximumYears}" value="${values.years ?? selectedYears}" required><span>שנים</span></div></label>
            <label class="input-group">ריבית<div class="input-wrap"><input class="track-rate" type="number" min="0" max="30" step="0.01" value="${values.rate ?? ''}" required><span>%</span></div></label>
            <label class="input-group">לוח סילוקין<select class="track-method"><option value="equal">שפיצר</option><option value="principal">קרן שווה</option></select></label>`
        tracksList.appendChild(track)
        track.querySelector('.remove-track').addEventListener('click', () => { if (tracksList.children.length > 1) { track.remove(); renumberTracks(); updateAddButton(); calculate() } })
        track.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', event => {
                if (event.target.classList.contains('track-amount')) {
                    formatAmountInput(event.target)
                    syncStartingAmountFromTracks()
                }
                if (event.target.classList.contains('track-years')) {
                    constrainTrackYears(event.target)
                    syncTermSliderFromTracks()
                }
                calculate()
            })
            input.addEventListener('change', calculate)
        })
        track.querySelector('.track-amount').addEventListener('blur', event => formatAmountInput(event.target))
        track.querySelector('.track-years').addEventListener('blur', event => {
            constrainTrackYears(event.target)
            if (!event.target.value) event.target.value = '1'
            syncTermSliderFromTracks()
            calculate()
        })
        updateAddButton()
        updateTrackLimits()
    }

    function updateAddButton() {
        const addButton = document.getElementById('add-track')
        const limitReached = tracksList.children.length >= maximumTracks
        addButton.hidden = limitReached
    }

    function updateTrackLimits() {
        tracksList.querySelectorAll('.track-amount').forEach(input => input.removeAttribute('max'))
        tracksList.querySelectorAll('.track-years').forEach(input => { input.max = maximumYears })
    }

    function renumberTracks() { 
        [...tracksList.children].forEach((track, index) => {
            track.querySelector('legend').textContent = `מסלול ${index + 1}`
        }) 
    }

    function loadPreset(name) {
        if (!presets[name]) return
        const existingTotal = [...tracksList.children].reduce((sum, track) => sum + getTrackAmount(track), 0)
        tracksList.innerHTML = ''
        const startingAmount = getStartingAmount() || existingTotal
        let allocatedAmount = 0
        presets[name].forEach((preset, index) => {
            const amount = index === presets[name].length - 1
                ? startingAmount - allocatedAmount
                : Math.round(startingAmount * preset.share)
            allocatedAmount += amount
            addTrack({ type: preset.type, amount, years: selectedYears, rate: preset.rate })
        })
        renumberTracks()
        document.querySelectorAll('.preset-button').forEach(button => button.classList.toggle('active', button.dataset.preset === name))
        startingPointDirty = false
        calculate()
    }

    function getTrackResult(track) {
        const amount = track.querySelector('.track-amount').value.replace(/[₪,\s]/g, '')
        const principal = Number(amount)
        const months = (Number(track.querySelector('.track-years').value) || 0) * 12
        const annualRate = Number(track.querySelector('.track-rate').value) || 0
        const trackType = track.querySelector('.track-type').value
        const isIndexed = trackType.includes('Indexed')
        const isVariable = trackType === 'prime' || trackType === 'variable' || trackType === 'variableIndexed'
        const inflationRate = Number.isFinite(window.mortgageIndexData?.annualChange) ? window.mortgageIndexData.annualChange : fallbackInflation
        const monthlyRate = annualRate / 100 / 12
        const method = track.querySelector('.track-method').value
        if (!Number.isFinite(principal) || principal <= 0 || months <= 0 || months > maximumYears * 12 || !Number.isFinite(annualRate) || annualRate < 0) return null
        
        const fixedPayment = monthlyRate === 0 ? principal / months : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months))
        let balance = principal, realBalance = principal, totalPaid = 0, totalInterest = 0, firstPayment = 0, highestPayment = 0, indexFactor = 1
        const yearlyRows = []
        let yearOpening = principal, yearPrincipal = 0, yearPaid = 0, yearInterest = 0
        
        for (let month = 1; month <= months; month++) {
            const realInterest = realBalance * monthlyRate
            const realPrincipalPart = method === 'principal' ? principal / months : fixedPayment - realInterest
            const realPayment = method === 'principal' ? realPrincipalPart + realInterest : fixedPayment
            if (isIndexed) indexFactor *= Math.pow(1 + inflationRate, 1 / 12)
            
            const interest = realInterest * indexFactor
            const principalPart = realPrincipalPart * indexFactor
            const payment = realPayment * indexFactor
            
            if (month === 1) firstPayment = payment
            highestPayment = Math.max(highestPayment, payment)
            
            realBalance = Math.max(0, realBalance - realPrincipalPart)
            balance = Math.max(0, realBalance * indexFactor)
            totalPaid += payment; totalInterest += interest; yearPrincipal += principalPart; yearPaid += payment; yearInterest += interest
            
            if (month % 12 === 0 || month === months) { 
                yearlyRows.push({ year: Math.ceil(month / 12), opening: yearOpening, principal: yearPrincipal, paid: yearPaid, interest: yearInterest, closing: balance }); 
                yearOpening = balance; yearPrincipal = 0; yearPaid = 0; yearInterest = 0 
            }
        }
        return { firstPayment, highestPayment, totalPaid, totalInterest, yearlyRows, type: trackType, years: months / 12, principal, isVariable, isIndexed, method }
    }

    function calculate(event) {
        if (event) event.preventDefault()
        updateTrackLimits()
        const invalidTerm = [...tracksList.children].some(track => {
            const years = Number(track.querySelector('.track-years').value)
            return !years || years < 1 || years > maximumYears
        })
        if (invalidTerm) {
            formError.textContent = 'תקופת ההלוואה יכולה להיות בין שנה ל-30 שנים.'
            formError.hidden = false
            return
        }
        const results = [...tracksList.children].map(getTrackResult)
        if (!results.length) {
            formError.textContent = ''
            formError.hidden = true
            document.getElementById('monthly-payment').textContent = currency.format(0)
            document.getElementById('total-interest').textContent = currency.format(0)
            document.getElementById('highest-payment').textContent = currency.format(0)
            document.getElementById('total-payment').textContent = currency.format(0)
            document.getElementById('payment-note').textContent = 'הוסיפו מסלול כדי להתחיל'
            document.getElementById('schedule-summary').textContent = ''
            document.getElementById('schedule-body').innerHTML = ''
            document.getElementById('annual-payment').textContent = currency.format(0)
            expandScheduleButton.hidden = true
            return
        }
        const hasEnteredTrackData = [...tracksList.children].some(track => {
            return track.querySelector('.track-amount').value.trim() || track.querySelector('.track-rate').value.trim()
        })
        if (results.every(result => !result) && !hasEnteredTrackData) {
            formError.textContent = ''
            formError.hidden = true
            return
        }
        if (results.some(result => !result)) {
            formError.textContent = 'נא להזין סכום חיובי בכל מסלול.'
            formError.hidden = false
            return
        }
        formError.textContent = ''
        const totalPrincipal = results.reduce((sum, result) => sum + result.principal, 0)
        const variablePrincipal = results.filter(result => result.isVariable).reduce((sum, result) => sum + result.principal, 0)
        if (variablePrincipal / totalPrincipal > 2 / 3 + 0.0001) {
            formError.textContent = 'בהתאם להוראות בנק ישראל, חלק המסלולים בריבית משתנה לא יעלה על 66.66% מסך המשכנתא.'
            formError.hidden = false
            return
        }
        formError.hidden = true
        
        const total = results.reduce((sum, result) => ({ 
            firstPayment: sum.firstPayment + result.firstPayment, 
            highestPayment: sum.highestPayment + result.highestPayment, 
            totalPaid: sum.totalPaid + result.totalPaid, 
            totalInterest: sum.totalInterest + result.totalInterest 
        }), { firstPayment: 0, highestPayment: 0, totalPaid: 0, totalInterest: 0 })
        
        document.getElementById('monthly-payment').textContent = currency.format(total.firstPayment)
        document.getElementById('total-interest').textContent = currency.format(total.totalInterest)
        document.getElementById('highest-payment').textContent = currency.format(total.highestPayment)
        document.getElementById('total-payment').textContent = currency.format(total.totalPaid)
        
        const trackCount = results.length
        const trackText = trackNames[trackCount] || `${trackCount} מסלולים`
        
        const hasIndexed = results.some(result => result.isIndexed)
        const hasVariable = results.some(result => result.isVariable)
        const allSpitzer = results.every(result => result.method !== 'principal')
        
        const highestPaymentLabel = document.getElementById('highest-payment-label')
        let dynamicNote = ''
        
        if (hasIndexed) {
            highestPaymentLabel.textContent = 'ההחזר הגבוה ביותר'
            dynamicNote = 'כולל הצמדה עתידית למדד (ההחזר עשוי לעלות)'
        } else if (!allSpitzer) {
            highestPaymentLabel.textContent = 'ההחזר החודשי הראשון (הגבוה)'
            dynamicNote = 'בקרן שווה ההחזר יורד עם השנים'
        } else if (hasVariable) {
            highestPaymentLabel.textContent = 'ההחזר החודשי הנוכחי'
            dynamicNote = 'בהנחה שהריבית לא תשתנה (בפועל הריבית עשויה להשתנות)'
        } else {
            highestPaymentLabel.textContent = 'ההחזר החודשי הקבוע'
            dynamicNote = 'בתמהיל לא צמוד ושפיצר, ההחזר זהה לאורך כל התקופה'
        }
        
        document.getElementById('payment-note').textContent = `${trackText} · ${dynamicNote}`
        document.getElementById('schedule-summary').textContent = results.map(result => trackTypes[result.type]).join(' · ')
        
        const combinedSchedule = []
        const scheduleYears = Math.max(...results.map(result => result.yearlyRows.length))
        for (let index = 0; index < scheduleYears; index++) {
            const rows = results.map(result => result.yearlyRows[index]).filter(Boolean)
            combinedSchedule.push({
                year: index + 1,
                opening: rows.reduce((sum, row) => sum + row.opening, 0),
                principal: rows.reduce((sum, row) => sum + row.principal, 0),
                paid: rows.reduce((sum, row) => sum + row.paid, 0),
                interest: rows.reduce((sum, row) => sum + row.interest, 0),
                closing: rows.reduce((sum, row) => sum + row.closing, 0)
            })
        }
        document.getElementById('annual-payment').textContent = currency.format(combinedSchedule[0]?.paid || 0)
        const rowsToShow = scheduleExpanded ? 30 : 15
        document.getElementById('schedule-body').innerHTML = combinedSchedule.slice(0, rowsToShow).map(row => `<tr><td>${row.year}</td><td>${currency.format(row.principal)}</td><td>${currency.format(row.interest)}</td><td>${currency.format(row.closing)}</td></tr>`).join('')
        expandScheduleButton.hidden = scheduleYears <= 15
        const maxYears = Math.max(...results.map(result => result.years))
        expandScheduleButton.textContent = scheduleExpanded ? 'הצג 15 שנים ראשונות' : `הצג פירוט ל-${maxYears} שנים`
    }

    document.querySelectorAll('.preset-button').forEach(button => button.addEventListener('click', () => {
        loadPreset(button.dataset.preset)
    }))
    
    startingAmountInput.addEventListener('input', () => {
        startingPointDirty = true
        formatAmountInput(startingAmountInput)
        scaleTrackAmounts()
        calculate()
    })
    startingAmountInput.addEventListener('blur', () => formatAmountInput(startingAmountInput))
    
    termYearsInput.addEventListener('input', () => {
        startingPointDirty = true
        updateTermSlider()
        applySelectedYears()
        calculate()
    })
    
    window.addEventListener('mortgage-index-updated', calculate)
    window.addEventListener('resize', updateTermSlider)
    
    document.getElementById('add-track').addEventListener('click', () => { 
        if (tracksList.children.length < maximumTracks) { 
            addTrack({ rate: 4.5, years: selectedYears })
            distributeTrackAmounts()
            renumberTracks()
            calculate() 
        } 
    })
    
    form.addEventListener('submit', event => {
        event.preventDefault()
        const activePreset = document.querySelector('.preset-button.active')?.dataset.preset
        if (activePreset && startingPointDirty) loadPreset(activePreset)
        else {
            if (startingPointDirty) {
                scaleTrackAmounts()
                applySelectedYears()
                updateTrackLimits()
                startingPointDirty = false
            }
            calculate()
        }
        if (!formError.textContent) {
            resultsLayout.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    })
    
    expandScheduleButton.addEventListener('click', () => { scheduleExpanded = !scheduleExpanded; calculate() })
    
    document.getElementById('reset-calculator').addEventListener('click', () => { 
        tracksList.innerHTML = ''; 
        startingAmountInput.value = '1,000,000'; 
        termYearsInput.value = '30'; 
        updateTermSlider(); 
        scheduleExpanded = false; 
        loadPreset('basket1') 
    })
    
    startingAmountInput.value = '1,000,000'
    updateTermSlider()
    loadPreset('basket1')
})()