document.addEventListener('DOMContentLoaded', () => {
    const tabOpen = document.getElementById('tab-open');
    const tabClosed = document.getElementById('tab-closed');
    const openSection = document.getElementById('open-positions-section');
    const closedSection = document.getElementById('closed-positions-section');
    const modalNew = document.getElementById('modal-new');
    const modalEdit = document.getElementById('modal-edit');
    const modalGroupEdit = document.getElementById('modal-group-edit');
    const modalGroupClose = document.getElementById('modal-group-close');
    const modalClose = document.getElementById('modal-close');
    const modalRoll = document.getElementById('modal-roll');
    const modalGroupRoll = document.getElementById('modal-group-roll');
    const btnNew = document.getElementById('btn-new-position');
    const btnAddLeg = document.getElementById('btn-add-leg');
    const legsContainer = document.getElementById('legs-container');
    const groupLegsContainer = document.getElementById('edit-group-legs-container');
    const groupCloseLegsContainer = document.getElementById('group-close-legs-tbody');
    const groupRollLegsTbody = document.getElementById('group-roll-legs-tbody');
    const formNew = document.getElementById('form-new');
    const formEdit = document.getElementById('form-edit');
    const formGroupEdit = document.getElementById('form-group-edit');
    const formGroupClose = document.getElementById('form-group-close');
    const formClose = document.getElementById('form-close');
    const formRoll = document.getElementById('form-roll');
    const formGroupRoll = document.getElementById('form-group-roll');
    const closeBtns = document.querySelectorAll('.close');
    const globalExpInput = document.getElementById('new-exp-date');
    const globalQtyInput = document.getElementById('new-qty');
    const globalMultiplierInput = document.getElementById('new-multiplier');
    const searchBox = document.getElementById('search-box');
    const btnClearFilter = document.getElementById('btn-clear-filter');
    const timeframeFilter = document.getElementById('timeframe-filter');

    let currentStatus = 'Open';
    let allPositions = [];
    let sortColumnOpen = 'expiry';
    let sortDirectionOpen = 'asc';
    let sortColumnClosed = 'close_date';
    let sortDirectionClosed = 'desc';

    searchBox.addEventListener('input', () => {
        renderTable(currentStatus, allPositions);
    });

    btnClearFilter.addEventListener('click', () => {
        searchBox.value = '';
        btnClearFilter.style.display = 'none';
        renderTable(currentStatus, allPositions);
    });

    if (timeframeFilter) {
        timeframeFilter.addEventListener('change', () => {
            renderTable(currentStatus, allPositions);
        });
    }

    // Header click listeners for column sorting
    document.querySelectorAll('table thead th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const table = th.closest('table');
            const status = table.id === 'table-open' ? 'Open' : 'Closed';
            const col = th.getAttribute('data-sort');
            
            if (status === 'Open') {
                if (sortColumnOpen === col) {
                    sortDirectionOpen = sortDirectionOpen === 'asc' ? 'desc' : 'asc';
                } else {
                    sortColumnOpen = col;
                    sortDirectionOpen = 'asc';
                }
            } else {
                if (sortColumnClosed === col) {
                    sortDirectionClosed = sortDirectionClosed === 'asc' ? 'desc' : 'asc';
                } else {
                    sortColumnClosed = col;
                    sortDirectionClosed = 'asc';
                }
            }
            
            renderTable(status, allPositions);
        });
    });

    function formatCurrency(num) {
        if (num === null || num === undefined || isNaN(num)) return '0.00';
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    }

    function getOriginalPrice(pos) {
        if (!pos) return 0;
        const openTrans = pos.transactions ? pos.transactions.find(t => t.transaction_type === 'BTO' || t.transaction_type === 'STO') : null;
        if (openTrans && openTrans.option_price !== null && openTrans.option_price !== undefined) {
            return openTrans.option_price;
        }
        const mult = pos.multiplier || 100;
        const qty = pos.current_quantity || 1;
        return Math.abs((pos.total_cost_usd || 0) / mult / qty);
    }

    function getNextFriday() {
        const today = new Date();
        const dayOfWeek = today.getUTCDay(); 
        const diff = (5 - dayOfWeek + 7) % 7;
        const nextFriday = new Date(today);
        nextFriday.setUTCDate(today.getUTCDate() + (diff === 0 ? 7 : diff));
        return nextFriday;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        return dateStr.split('T')[0];
    }

    function isDateInTimeframe(dateVal, timeframe) {
        if (timeframe === 'all') return true;
        if (!dateVal) return false;
        
        const testDate = new Date(dateVal);
        const now = new Date();
        
        // Start of today (local time)
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (timeframe === 'today') {
            return testDate >= startOfToday;
        }
        if (timeframe === 'week') {
            const day = now.getDay();
            const startOfWeek = new Date(startOfToday.getTime() - day * 24 * 60 * 60 * 1000);
            return testDate >= startOfWeek;
        }
        if (timeframe === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return testDate >= startOfMonth;
        }
        if (timeframe === '30days') {
            const startOf30DaysAgo = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);
            return testDate >= startOf30DaysAgo;
        }
        if (timeframe === 'ytd') {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            return testDate >= startOfYear;
        }
        return true;
    }



    function updateHeaderSortIndicators(status) {
        const tableId = status === 'Open' ? 'table-open' : 'table-closed';
        const activeCol = status === 'Open' ? sortColumnOpen : sortColumnClosed;
        const activeDir = status === 'Open' ? sortDirectionOpen : sortDirectionClosed;
        
        const headers = document.querySelectorAll(`#${tableId} thead th[data-sort]`);
        headers.forEach(th => {
            let text = th.textContent.replace(/ [▲▼]/g, '');
            const col = th.getAttribute('data-sort');
            if (col === activeCol) {
                text += activeDir === 'asc' ? ' ▲' : ' ▼';
            }
            th.textContent = text;
        });
    }

    // Tab switching
    tabOpen.addEventListener('click', () => {
        tabOpen.classList.add('active');
        tabClosed.classList.remove('active');
        openSection.style.display = 'block';
        closedSection.style.display = 'none';
        currentStatus = 'Open';
        if (timeframeFilter) {
            timeframeFilter.value = 'all'; // Default to all time
        }
        loadPositions('Open');
    });

    tabClosed.addEventListener('click', () => {
        tabClosed.classList.add('active');
        tabOpen.classList.remove('active');
        closedSection.style.display = 'block';
        openSection.style.display = 'none';
        currentStatus = 'Closed';
        loadPositions('Closed');
    });

    // Modal handling
    btnNew.addEventListener('click', () => {
        modalNew.style.display = 'block';
        document.getElementById('new-date').valueAsDate = new Date();
        globalExpInput.valueAsDate = getNextFriday();
        globalMultiplierInput.value = 100;
        const overrideCheckbox = document.getElementById('new-override-max-loss');
        if (overrideCheckbox) overrideCheckbox.checked = false;
        legsContainer.innerHTML = '';
        addLegEntry(); 
        calculateMaxLoss(); // Initialize fields
    });

    const newOverrideCheckbox = document.getElementById('new-override-max-loss');
    if (newOverrideCheckbox) {
        newOverrideCheckbox.addEventListener('change', () => {
            calculateMaxLoss();
            if (newOverrideCheckbox.checked) {
                document.getElementById('new-max-loss').focus();
            }
        });
    }

    btnAddLeg.addEventListener('click', () => {
        addLegEntry();
    });

    function formatContractName(expDateStr, strike, cp, symbol = '') {
        if (!expDateStr || !strike || !cp) return '';
        const date = new Date(expDateStr);
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        const mmm = months[date.getUTCMonth()];
        const dd = String(date.getUTCDate()).padStart(2, '0');
        const yy = String(date.getUTCFullYear()).slice(-2);
        const prefix = symbol ? `${symbol.trim()} ` : '';
        return `${prefix}${mmm} ${dd} '${yy} ${strike} ${cp}`;
    }

    function setMaxLossInputState(inputEl, isOverridden) {
        if (!inputEl) return;
        if (isOverridden) {
            inputEl.removeAttribute('readonly');
            inputEl.classList.remove('max-loss-input-readonly');
            inputEl.classList.add('max-loss-input-editable');
        } else {
            inputEl.setAttribute('readonly', 'true');
            inputEl.classList.remove('max-loss-input-editable');
            inputEl.classList.add('max-loss-input-readonly');
        }
    }

    function calculateMaxLoss() {
        const overrideCheckbox = document.getElementById('new-override-max-loss');
        const maxLossInput = document.getElementById('new-max-loss');
        const isOverridden = overrideCheckbox && overrideCheckbox.checked;
        setMaxLossInputState(maxLossInput, isOverridden);

        const legs = Array.from(legsContainer.querySelectorAll('.leg-entry'));
        const qty = parseInt(globalQtyInput.value) || 0;
        const multiplier = parseFloat(globalMultiplierInput.value) || 0;
        let totalNetUsd = 0;
        legs.forEach(leg => {
            totalNetUsd += parseFloat(leg.querySelector('.leg-usd').value) || 0;
        });

        let maxLoss = 0;
        let breakeven = 0;

        if (legs.length === 1) {
            const type = legs[0].querySelector('.leg-type').value;
            const cp = legs[0].querySelector('.leg-cp').value;
            const strike = parseFloat(legs[0].querySelector('.leg-strike').value) || 0;
            const netPremiumPerShare = Math.abs(totalNetUsd / multiplier / qty);
            
            if (type === 'STO' && cp === 'Put') {
                maxLoss = Math.abs(strike * multiplier * qty) - totalNetUsd;
                breakeven = strike - netPremiumPerShare;
            } else if (type === 'BTO' && cp === 'Put') {
                maxLoss = Math.abs(totalNetUsd);
                breakeven = strike - netPremiumPerShare;
            } else if (type === 'STO' && cp === 'Call') {
                maxLoss = 0;
                breakeven = strike + netPremiumPerShare;
            } else if (type === 'BTO' && cp === 'Call') {
                maxLoss = Math.abs(totalNetUsd);
                breakeven = strike + netPremiumPerShare;
            }
        } else if (legs.length === 2) {
            const types = legs.map(l => l.querySelector('.leg-type').value);
            const cp = legs[0].querySelector('.leg-cp').value;
            const strikes = legs.map(l => parseFloat(l.querySelector('.leg-strike').value) || 0);
            const netPremiumPerShare = Math.abs(totalNetUsd / multiplier / qty);
            
            if (types.includes('STO') && types.includes('BTO')) {
                const strikeWidth = Math.abs(strikes[0] - strikes[1]);
                if (totalNetUsd > 0) { // Credit Spread
                    maxLoss = (strikeWidth * multiplier * qty) - totalNetUsd;
                    if (cp === 'Put') {
                        const shortStrike = parseFloat(legs.find(l => l.querySelector('.leg-type').value === 'STO').querySelector('.leg-strike').value);
                        breakeven = shortStrike - netPremiumPerShare;
                    } else {
                        const shortStrike = parseFloat(legs.find(l => l.querySelector('.leg-type').value === 'STO').querySelector('.leg-strike').value);
                        breakeven = shortStrike + netPremiumPerShare;
                    }
                } else { // Debit Spread
                    maxLoss = Math.abs(totalNetUsd);
                    if (cp === 'Put') {
                        const longStrike = parseFloat(legs.find(l => l.querySelector('.leg-type').value === 'BTO').querySelector('.leg-strike').value);
                        breakeven = longStrike - netPremiumPerShare;
                    } else {
                        const longStrike = parseFloat(legs.find(l => l.querySelector('.leg-type').value === 'BTO').querySelector('.leg-strike').value);
                        breakeven = longStrike + netPremiumPerShare;
                    }
                }
            }
        }
        if (!isOverridden) {
            maxLossInput.value = formatCurrency(maxLoss);
        }
        const beEl = document.getElementById('new-breakeven');
        if (beEl) {
            beEl.textContent = breakeven > 0 ? formatCurrency(breakeven) : '-';
        }
        const netTotalEl = document.getElementById('new-net-total');
        if (netTotalEl) {
            const desc = totalNetUsd >= 0 ? 'Net Credit' : 'Net Debit';
            netTotalEl.textContent = `${totalNetUsd >= 0 ? '+' : ''}${formatCurrency(totalNetUsd)} (${desc})`;
            netTotalEl.className = `group-roll-stat-val ${totalNetUsd >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
        }
    }

    function updateAllLegs() {
        const symbol = (document.getElementById('new-symbol').value || '').trim().toUpperCase();
        legsContainer.querySelectorAll('.leg-entry').forEach(div => {
            const strikeInput = div.querySelector('.leg-strike');
            const cpSelect = div.querySelector('.leg-cp');
            const contractInput = div.querySelector('.leg-contract');
            const priceInput = div.querySelector('.leg-price');
            const commInput = div.querySelector('.leg-comm');
            const usdInput = div.querySelector('.leg-usd');
            const typeSelect = div.querySelector('.leg-type');
            
            const expDate = globalExpInput.value;
            const strike = strikeInput.value;
            const cp = cpSelect.value;
            const autoName = formatContractName(expDate, strike, cp, symbol);
            if (autoName) contractInput.value = autoName;

            const qty = parseInt(globalQtyInput.value) || 0;
            const multiplier = parseFloat(globalMultiplierInput.value) || 0;
            const price = parseFloat(priceInput.value) || 0;
            const comm = parseFloat(commInput.value) || 0;
            const type = typeSelect.value;
            
            let total = qty * price * multiplier;
            if (type === 'BTO' || type === 'BTC') {
                usdInput.value = (-(total + comm)).toFixed(2);
            } else {
                usdInput.value = (total - comm).toFixed(2);
            }
        });
        calculateMaxLoss();
    }

    globalExpInput.addEventListener('input', updateAllLegs);
    globalQtyInput.addEventListener('input', updateAllLegs);
    globalMultiplierInput.addEventListener('input', updateAllLegs);

    document.getElementById('new-symbol').addEventListener('input', (e) => {
        const symbol = e.target.value.toUpperCase().trim();
        if (symbol === 'NQ') {
            globalMultiplierInput.value = 20;
        } else if (symbol === 'MNQ') {
            globalMultiplierInput.value = 2;
        } else if (symbol && symbol !== 'NQ' && symbol !== 'MNQ' && globalMultiplierInput.value != 100) {
            globalMultiplierInput.value = 100;
        }
        updateAllLegs();
    });

    function updateLegNumbers() {
        if (!legsContainer) return;
        Array.from(legsContainer.children).forEach((row, i) => {
            if (row.children[0]) row.children[0].textContent = i + 1;
        });
    }

    function addLegEntry() {
        const existingLegs = Array.from(legsContainer.querySelectorAll('.leg-entry'));
        const index = existingLegs.length;
        const tr = document.createElement('tr');
        tr.className = 'leg-entry roll-leg-row';
        
        let defaultCP = 'Put';
        let defaultType = 'STO';

        // When adding subsequent legs, reverse the action of the leg directly above (e.g. STO -> BTO for Put Credit Spread)
        if (existingLegs.length > 0) {
            const prevLeg = existingLegs[existingLegs.length - 1];
            const prevCP = prevLeg.querySelector('.leg-cp');
            const prevType = prevLeg.querySelector('.leg-type');
            defaultCP = prevCP ? prevCP.value : 'Put';
            defaultType = (prevType && prevType.value === 'STO') ? 'BTO' : 'STO';
        }

        tr.innerHTML = `
            <td style="text-align: center; color: #94a3b8; font-weight: bold;">${index + 1}</td>
            <td>
                <input type="text" class="roll-input leg-contract" required placeholder="Auto-generated" readonly style="opacity: 0.85;">
            </td>
            <td>
                <input type="number" class="roll-input leg-strike" step="any" required placeholder="0.00">
            </td>
            <td>
                <select class="roll-input leg-cp">
                    <option value="Call" ${defaultCP === 'Call' ? 'selected' : ''}>Call</option>
                    <option value="Put" ${defaultCP === 'Put' ? 'selected' : ''}>Put</option>
                </select>
            </td>
            <td>
                <select class="roll-input leg-type">
                    <option value="BTO" ${defaultType === 'BTO' ? 'selected' : ''}>BTO</option>
                    <option value="STO" ${defaultType === 'STO' ? 'selected' : ''}>STO</option>
                </select>
            </td>
            <td>
                <input type="number" class="roll-input leg-price" step="any" placeholder="0.00" required>
            </td>
            <td>
                <input type="number" class="roll-input leg-comm" step="any" value="0.00">
            </td>
            <td>
                <input type="number" class="roll-input leg-usd" step="any" readonly style="opacity: 0.85; font-weight: bold;">
            </td>
            <td style="text-align: center;">
                <button type="button" class="btn-icon btn-remove-leg" onclick="this.closest('tr').remove(); updateLegNumbers(); updateAllLegs();" title="Remove Leg">🗑️</button>
            </td>
        `;
        legsContainer.appendChild(tr);

        // Explicitly set select element values
        const cpEl = tr.querySelector('.leg-cp');
        if (cpEl) cpEl.value = defaultCP;
        const typeEl = tr.querySelector('.leg-type');
        if (typeEl) typeEl.value = defaultType;

        tr.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('input', updateAllLegs);
            el.addEventListener('change', updateAllLegs);
        });
        updateAllLegs();
    }

    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modalNew.style.display = 'none';
            modalEdit.style.display = 'none';
            modalGroupEdit.style.display = 'none';
            modalGroupClose.style.display = 'none';
            modalClose.style.display = 'none';
            if (modalRoll) modalRoll.style.display = 'none';
            if (modalGroupRoll) modalGroupRoll.style.display = 'none';
        });
    });

    window.onclick = (event) => { /* Disabled auto-close */ };

    async function loadPositions(status) {
        try {
            const response = await fetch(`api/positions?status=${status}`);
            if (!response.ok) throw new Error('API failed');
            const data = await response.json();
            allPositions = data.positions;
            renderTable(status, allPositions);

            if (status === 'Open') {
                const tsEl = document.getElementById('ib-timestamp');
                if (data.metadata && data.metadata.ib_report_datetime) {
                    const formattedTimestamp = new Date(data.metadata.ib_report_datetime + 'Z').toLocaleString('sv-SE', { timeZone: 'Asia/Singapore' }) + ' GMT+8';
                    tsEl.textContent = `(As of: ${formattedTimestamp})`;
                } else {
                    tsEl.textContent = '';
                }
            }
        } catch (error) {
            console.error('Error fetching positions:', error);
            const tbody = document.querySelector(`#table-${status.toLowerCase()} tbody`);
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:red;">Error loading data. Check if database needs migration.</td></tr>`;
        }
    }

    function formatExpiryWithDTE(expiryStr) {
        if (!expiryStr) return '-';
        const datePart = expiryStr.split('T')[0];
        
        // Calculate days to expiration
        const todayObj = new Date();
        todayObj.setHours(0,0,0,0);
        
        const expObj = new Date(expiryStr);
        expObj.setHours(0,0,0,0);
        
        const diffMs = expObj - todayObj;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        
        let dteStr = '';
        if (diffDays === 0) {
            dteStr = '(today)';
        } else if (diffDays > 0) {
            dteStr = `(${diffDays}d)`;
        } else {
            dteStr = '(expired)';
        }
        
        return `
            <div style="font-weight: bold; color: #ffffff; white-space: nowrap;">${datePart}</div>
            <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 2px;">${dteStr}</div>
        `;
    }

    function formatMaxLossAndAR(maxLoss, cashRequired) {
        const lossDisplay = maxLoss > 0 ? `<div style="font-weight: bold; color: var(--danger-color);">${formatCurrency(maxLoss)}</div>` : `<div style="color: #94a3b8;">-</div>`;
        const arDisplay = cashRequired > 0 ? `<div style="font-size: 0.8rem; color: #94a3b8; margin-top: 2px;">${formatCurrency(cashRequired)}</div>` : '';
        return `${lossDisplay}${arDisplay}`;
    }

    function calculateHoldTime(dateOpenedStr, dateClosedStr) {
        if (!dateOpenedStr || !dateClosedStr) return '-';
        const opened = new Date(dateOpenedStr);
        opened.setHours(0,0,0,0);
        
        const closed = new Date(dateClosedStr);
        closed.setHours(0,0,0,0);
        
        const diffMs = closed - opened;
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        
        return diffDays >= 0 ? `${diffDays}d` : '-';
    }

    function renderTable(status, positions) {
        const tbody = document.querySelector(`#table-${status.toLowerCase()} tbody`);
        tbody.innerHTML = '';

        const searchValue = searchBox.value.toLowerCase().trim();
        
        let filteredPositions = positions;

        if (searchValue) {
            filteredPositions = filteredPositions.filter(p => 
                p.symbol.toLowerCase().includes(searchValue) || 
                p.group_id.toLowerCase().includes(searchValue)
            );
            btnClearFilter.style.display = 'block';
        } else {
            btnClearFilter.style.display = 'none';
        }

        let totalUsd = 0;
        let totalRisk = 0;
        let totalAR = 0;
        let totalIbUnrealized = 0;
        let anyIbData = false;

        const groups = {};
        filteredPositions.forEach(pos => {
            if (!groups[pos.group_id]) groups[pos.group_id] = [];
            groups[pos.group_id].push(pos);
        });

        let groupList = Object.values(groups);

        // Apply Timeframe Filter
        const timeframeValue = timeframeFilter ? timeframeFilter.value : 'all';
        if (timeframeValue !== 'all') {
            groupList = groupList.filter(group => {
                if (status === 'Open') {
                    return isDateInTimeframe(group[0].date_opened, timeframeValue);
                } else {
                    const dates = group.flatMap(p => p.transactions)
                        .filter(t => t.transaction_type !== 'BTO' && t.transaction_type !== 'STO')
                        .map(t => new Date(t.date).getTime())
                        .filter(t => !isNaN(t));
                    const latestCloseTime = dates.length > 0 ? Math.max(...dates) : 0;
                    return latestCloseTime > 0 && isDateInTimeframe(latestCloseTime, timeframeValue);
                }
            });
        }

        // Apply Column Sorting
        groupList.sort((a, b) => {
            let comparison = 0;
            if (status === 'Open') {
                if (sortColumnOpen === 'symbol') {
                    comparison = a[0].symbol.localeCompare(b[0].symbol);
                } else if (sortColumnOpen === 'opened') {
                    const dateA = a[0].date_opened ? new Date(a[0].date_opened).getTime() : 0;
                    const dateB = b[0].date_opened ? new Date(b[0].date_opened).getTime() : 0;
                    comparison = dateA - dateB;
                } else if (sortColumnOpen === 'expiry') {
                    const dateA = a[0].expiration_date ? new Date(a[0].expiration_date) : new Date(0);
                    const dateB = b[0].expiration_date ? new Date(b[0].expiration_date) : new Date(0);
                    comparison = dateA - dateB;
                } else if (sortColumnOpen === 'max_loss') {
                    const lossA = a[0].max_loss || 0;
                    const lossB = b[0].max_loss || 0;
                    comparison = lossA - lossB;
                } else if (sortColumnOpen === 'pnl') {
                    const valA = a.reduce((sum, p) => sum + p.total_cost_usd, 0);
                    const valB = b.reduce((sum, p) => sum + p.total_cost_usd, 0);
                    comparison = valA - valB;
                }
                return sortDirectionOpen === 'asc' ? comparison : -comparison;
            } else {
                if (sortColumnClosed === 'symbol') {
                    comparison = a[0].symbol.localeCompare(b[0].symbol);
                } else if (sortColumnClosed === 'hold_time') {
                    const getHoldTimeDays = (g) => {
                        const firstPos = g[0];
                        const closeTransDates = g.flatMap(p => p.transactions)
                            .filter(t => t.transaction_type !== 'BTO' && t.transaction_type !== 'STO')
                            .map(t => new Date(t.date).getTime())
                            .filter(t => !isNaN(t));
                        if (closeTransDates.length === 0 || !firstPos.date_opened) return 0;
                        return Math.max(...closeTransDates) - new Date(firstPos.date_opened).getTime();
                    };
                    comparison = getHoldTimeDays(a) - getHoldTimeDays(b);
                } else if (sortColumnClosed === 'pnl') {
                    const valA = a.reduce((sum, p) => sum + p.realized_pnl_usd, 0);
                    const valB = b.reduce((sum, p) => sum + p.realized_pnl_usd, 0);
                    comparison = valA - valB;
                } else { // default: close_date
                    const getLatestCloseDate = (g) => {
                        const dates = g.flatMap(p => p.transactions)
                            .filter(t => t.transaction_type !== 'BTO' && t.transaction_type !== 'STO')
                            .map(t => new Date(t.date).getTime())
                            .filter(t => !isNaN(t));
                        return dates.length > 0 ? Math.max(...dates) : 0;
                    };
                    comparison = getLatestCloseDate(a) - getLatestCloseDate(b);
                }
                return sortDirectionClosed === 'asc' ? comparison : -comparison;
            }
        });

        // Update sort indicators on headers
        updateHeaderSortIndicators(status);

        if (status === 'Open') {
            groupList.forEach(group => {
                const firstPos = group[0];
                const isSpread = group.length > 1;
                
                // Accumulate total risk (max loss) for footer
                totalRisk += firstPos.max_loss || 0;

                // Calculate group total cost / premium (Potential Return)
                let groupTotalValue = group.reduce((sum, p) => sum + p.total_cost_usd, 0);
                totalUsd += groupTotalValue;

                // Calculate Cash Required (AR Collateral) for the group
                const groupCashRequired = group.reduce((sum, p) => {
                    if (p.initial_type === 'STO' && p.call_put === 'Put') {
                        return sum + (p.strike_price * p.multiplier * p.current_quantity);
                    }
                    return sum;
                }, 0);
                totalAR += groupCashRequired;

                // Calculate Group IB Unrealized P/L
                const groupIbUnrealized = group.reduce((sum, p) => sum + (p.ib_unrealized_profits || 0), 0);
                const groupHasIbData = group.some(p => p.ib_unrealized_profits !== null && p.ib_unrealized_profits !== undefined);

                if (groupHasIbData) {
                    totalIbUnrealized += groupIbUnrealized;
                    anyIbData = true;
                }

                // Create Main Row
                const tr = document.createElement('tr');
                
                // 1. Column: Underlying (Symbol)
                const underlyingLink = `
                    <a href="details?group_id=${firstPos.group_id}" target="_blank" class="symbol-link-v2" title="View Full Details">${firstPos.symbol}</a>
                    <span class="price-val" data-symbol="${firstPos.symbol}" style="font-size: 0.85rem; color: #94a3b8; font-weight: normal; margin-left: 8px;">Loading...</span>
                `;
                
                // 2. Column: Strategy Legs
                let legsHtml = '';
                group.forEach(pos => {
                    const legInitialQty = pos.transactions
                        .filter(t => t.transaction_type === 'BTO' || t.transaction_type === 'STO')
                        .reduce((sum, t) => sum + t.quantity, 0);
                    const qtyDisplay = pos.current_quantity < legInitialQty ? `${pos.current_quantity} / ${legInitialQty}` : pos.current_quantity;
                    
                    const typeClass = pos.initial_type === 'STO' ? 'leg-type-sto' : 'leg-type-bto';
                    const dateOpenedStr = formatDate(pos.date_opened);
                    
                    let ibLegInfoHtml = '';
                    if (pos.ib_current_price !== null && pos.ib_current_price !== undefined) {
                        const ibPnl = pos.ib_unrealized_profits !== null ? pos.ib_unrealized_profits : 0;
                        const pnlClass = ibPnl >= 0 ? 'ib-pnl-pos' : 'ib-pnl-neg';
                        const pnlSign = ibPnl > 0 ? '+' : '';
                        ibLegInfoHtml = `
                            <span class="leg-date mobile-only-inline" style="color: #64748b;">|</span>
                            <span class="leg-ib-inline mobile-only-inline" style="font-size: 0.85rem; color: #94a3b8; font-family: monospace;">
                                IB Cur: <span style="color: #ffffff;">${formatCurrency(pos.ib_current_price)}</span> (P/L: <span class="${pnlClass}">${pnlSign}${formatCurrency(ibPnl)}</span>)
                            </span>
                        `;
                    }
                    
                    let mobileRiskStatusHtml = '';
                    if (pos.strike_price !== null) {
                        mobileRiskStatusHtml = `
                            <span class="leg-date mobile-only-inline" style="color: #64748b;">|</span>
                            <span class="risk-status mobile-only-inline" data-symbol="${pos.symbol}" data-strike="${pos.strike_price}" data-cp="${pos.call_put}" style="font-size: 0.85rem; font-family: monospace; font-weight: bold;">Loading...</span>
                        `;
                    }
                    
                    const occ = pos.occ_symbol || '';
                    let rollBadgeHtml = '';
                    if (pos.roll_count && pos.roll_count > 0) {
                        const pnlSign = (pos.campaign_realized_pnl || 0) >= 0 ? '+' : '';
                        const pnlText = `Campaign Realized: ${pnlSign}${formatCurrency(pos.campaign_realized_pnl || 0)}`;
                        rollBadgeHtml = `<span class="badge-roll" title="${pnlText}">Roll #${pos.roll_count}</span>`;
                    }
                    let hedgeBadgeHtml = '';
                    if (pos.has_assigned_leg && pos.initial_type === 'BTO') {
                        hedgeBadgeHtml = `<span class="badge-hedge" title="Paired short leg was assigned; holding as protective hedge">🛡️ Spread Hedge</span>`;
                    }
                    legsHtml += `
                        <div style="margin-bottom: 6px;">
                            <div class="strategy-leg-item">
                                <span class="${typeClass}">[${pos.initial_type}]</span>
                                <span class="leg-qty">${qtyDisplay} x</span>
                                <span class="leg-contract-name" title="OCC Symbol: ${occ}">${pos.contract_name}</span>
                                ${rollBadgeHtml}
                                ${hedgeBadgeHtml}
                                <span class="leg-date">(${dateOpenedStr})</span>
                                ${ibLegInfoHtml}
                                ${mobileRiskStatusHtml}
                            </div>
                        </div>
                    `;
                });
                legsHtml = `<div class="legs-wrapper">${legsHtml}</div>`;
                
                // 3. Column: Expiry & DTE
                const expiryHtml = formatExpiryWithDTE(firstPos.expiration_date);
                
                // 4. Column: Price (Open/Cur)
                let groupOpenPriceVal = 0;
                let groupCurrentPriceVal = 0;
                let hasCurrentPrice = false;

                group.forEach(pos => {
                    const openTrans = pos.transactions.find(t => t.transaction_type === 'BTO' || t.transaction_type === 'STO');
                    const openPrice = openTrans ? openTrans.option_price : 0;
                    const sign = pos.initial_type === 'STO' ? 1 : -1;
                    
                    groupOpenPriceVal += openPrice * sign;
                    
                    if (pos.ib_current_price !== null && pos.ib_current_price !== undefined) {
                        groupCurrentPriceVal += pos.ib_current_price * sign;
                        hasCurrentPrice = true;
                    }
                });

                const openPriceText = formatCurrency(Math.abs(groupOpenPriceVal));
                const currentPriceText = hasCurrentPrice ? formatCurrency(Math.abs(groupCurrentPriceVal)) : '-';

                const priceHtml = `
                    <div style="font-weight: bold; color: #ffffff;">
                        Open: ${openPriceText}
                    </div>
                    <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 2px;">
                        Cur: ${currentPriceText}
                    </div>
                `;
                
                // 5. Column: Max Loss & AR Collateral
                const maxLossHtml = formatMaxLossAndAR(firstPos.max_loss || 0, groupCashRequired);
                
                // 6. Column: Potential Return & ROI (and stacked IB Group P/L with percentage)
                const maxLossVal = firstPos.max_loss || 0;
                const roi = maxLossVal > 0 ? ((Math.abs(groupTotalValue) / maxLossVal) * 100).toFixed(2) : null;
                const roiDisplay = roi ? ` <span class="roi-percent">(${roi}%)</span>` : '';
                const potentialReturnClass = groupTotalValue >= 0 ? 'pnl-positive' : 'pnl-negative';
                
                let groupIbPnLHtml = '';
                if (groupHasIbData) {
                    const groupPnLClass = groupIbUnrealized >= 0 ? 'ib-pnl-pos' : 'ib-pnl-neg';
                    const groupPnLSign = groupIbUnrealized > 0 ? '+' : '';
                    
                    // Calculate unrealized P/L percentage against max potential returns (net initial premium)
                    const ibPnlPercentVal = Math.abs(groupTotalValue) > 0 
                        ? (groupIbUnrealized / Math.abs(groupTotalValue)) * 100 
                        : 0;
                    const ibPnlPercentDisplay = ibPnlPercentVal !== 0 
                        ? ` (${ibPnlPercentVal > 0 ? '+' : ''}${ibPnlPercentVal.toFixed(2)}%)` 
                        : '';

                    groupIbPnLHtml = `
                        <div style="font-size: 0.8rem; margin-top: 4px; color: #94a3b8; font-weight: normal;">
                            IB P/L: <span class="${groupPnLClass}">${groupPnLSign}${formatCurrency(groupIbUnrealized)}${ibPnlPercentDisplay}</span>
                        </div>
                    `;
                }
                
                const potentialReturnHtml = `
                    <div style="font-weight: bold;">
                        <span class="${potentialReturnClass}">${formatCurrency(groupTotalValue)}</span>${roiDisplay}
                    </div>
                    ${groupIbPnLHtml}
                `;
                
                // 7. Column: Actions
                let actionsHtml = '';
                const detailsUrl = `details?group_id=${firstPos.group_id}`;
                if (isSpread) {
                    actionsHtml = `
                        <button class="btn-icon btn-toggle-drawer" title="Toggle Legs Drawer (ℹ️)" onclick="toggleDetails(this, '${firstPos.group_id}')">ℹ️</button>
                        <button class="btn-action-pill btn-roll" title="Roll Strategy / Spread" onclick="openGroupRollModal('${firstPos.group_id}')">🔄 Roll</button>
                        <button class="btn-action-pill btn-close" title="Close Strategy / Group" onclick="openGroupCloseModal('${firstPos.group_id}')">✅ Close</button>
                        <div class="action-menu-dropdown">
                            <button class="btn-icon btn-action-more" title="More Options" onclick="toggleActionMenu(event, this)">•••</button>
                            <div class="action-menu-popover" style="display: none;">
                                <button class="action-menu-item" onclick="openGroupEditModal('${firstPos.group_id}')">✏️ Edit Group</button>
                                <a class="action-menu-item" href="${detailsUrl}" target="_blank">🔗 Strategy Details</a>
                                <div class="action-menu-divider"></div>
                                <button class="action-menu-item item-danger" onclick="deleteGroup('${firstPos.group_id}')">🗑️ Delete Group</button>
                            </div>
                        </div>
                    `;
                } else {
                    actionsHtml = `
                        <button class="btn-icon btn-toggle-drawer" title="Toggle Legs Drawer (ℹ️)" onclick="toggleDetails(this, '${firstPos.group_id}')">ℹ️</button>
                        <button class="btn-action-pill btn-roll" title="Roll Position" onclick="openRollModal(${firstPos.id})">🔄 Roll</button>
                        <button class="btn-action-pill btn-close" title="Close Position" onclick="openCloseModal(${firstPos.id}, '${firstPos.initial_type}', ${firstPos.current_quantity})">✅ Close</button>
                        <div class="action-menu-dropdown">
                            <button class="btn-icon btn-action-more" title="More Options" onclick="toggleActionMenu(event, this)">•••</button>
                            <div class="action-menu-popover" style="display: none;">
                                <button class="action-menu-item" onclick="openEditModal(${firstPos.id})">✏️ Edit Position</button>
                                <a class="action-menu-item" href="${detailsUrl}" target="_blank">🔗 Strategy Details</a>
                                <div class="action-menu-divider"></div>
                                <button class="action-menu-item item-danger" onclick="deletePosition(${firstPos.id})">🗑️ Delete Position</button>
                            </div>
                        </div>
                    `;
                }
                
                tr.innerHTML = `
                    <td class="cell-legs" data-label="Position">
                        <div class="position-underlying-header">${underlyingLink}</div>
                        ${legsHtml}
                    </td>
                    <td class="cell-opened" data-label="Opened" style="vertical-align: middle;">${formatDate(firstPos.date_opened)}</td>
                    <td class="cell-expiry" data-label="Expiry">${expiryHtml}</td>
                    <td class="cell-price" data-label="Price (Open/Cur)" style="vertical-align: middle;">${priceHtml}</td>
                    <td class="cell-maxloss" data-label="Max Loss / AR">${maxLossHtml}</td>
                    <td class="cell-return" data-label="Premium / P/L">${potentialReturnHtml}</td>
                    <td class="action-cell" data-label="Actions"><div class="action-cell-inner">${actionsHtml}</div></td>
                `;
                
                tbody.appendChild(tr);
                
                // Create Details Row for the entire group
                const detailsTr = document.createElement('tr');
                detailsTr.className = `details-row pos-details-${firstPos.group_id}`;
                detailsTr.style.display = 'none';
                
                let detailsLegsHtml = '';
                group.forEach(pos => {
                    const legCashRequired = (pos.initial_type === 'STO' && pos.call_put === 'Put') 
                        ? (pos.strike_price * pos.multiplier * pos.current_quantity) 
                        : null;
                    
                    const openTrans = pos.transactions.find(t => t.transaction_type === 'BTO' || t.transaction_type === 'STO');
                    const openPrice = openTrans ? formatCurrency(openTrans.option_price) : '-';

                    let legIbDetailsHtml = '';
                    if (pos.ib_current_price !== null && pos.ib_current_price !== undefined) {
                        const legPnLVal = pos.ib_unrealized_profits || 0;
                        const legPnLClass = legPnLVal >= 0 ? 'pnl-positive' : 'pnl-negative';
                        const legPnLSign = legPnLVal > 0 ? '+' : '';
                        legIbDetailsHtml = `
                            <div style="flex: 1;">
                                <span style="color: #94a3b8;">IB Price:</span>
                                <span style="color: #ffffff;">${formatCurrency(pos.ib_current_price)}</span>
                            </div>
                            <div style="flex: 1;">
                                <span style="color: #94a3b8;">IB Unrealized P/L:</span>
                                <span class="${legPnLClass}" style="font-weight: bold;">${legPnLSign}${formatCurrency(legPnLVal)}</span>
                            </div>
                        `;
                    }
                    
                    const occ = pos.occ_symbol || '';
                    let closeBtnLabel = '✅ Close / Assign';
                    let closeBtnTitle = 'Close or assign this short put';
                    if (pos.initial_type === 'BTO') {
                        closeBtnLabel = '✅ Close / Exercise';
                        closeBtnTitle = 'Close or exercise this long contract';
                    } else if (pos.call_put === 'Call') {
                        closeBtnLabel = '✅ Close / Called Away';
                        closeBtnTitle = 'Close or mark this short call called away';
                    }

                    detailsLegsHtml += `
                        <div class="drawer-leg-item" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 8px 0;">
                            <div style="font-weight: bold; color: #ffffff; margin-bottom: 4px;">
                                ${pos.initial_type} ${pos.current_quantity}x ${pos.contract_name}
                                <span style="font-size: 0.8rem; font-family: monospace; color: #64748b; margin-left: 10px;">(${occ})</span>
                                <button class="btn-icon-small" title="Roll this leg" onclick="openRollModal(${pos.id})">🔄 Roll</button>
                                <button class="btn-icon-small" title="${closeBtnTitle}" onclick="openCloseModal(${pos.id}, '${pos.initial_type}', ${pos.current_quantity})">${closeBtnLabel}</button>
                            </div>
                            <div style="display: flex; gap: 20px; font-size: 0.9rem;">
                                <div style="flex: 1;">
                                    <span style="color: #94a3b8;">Assignment Status:</span>
                                    <span class="risk-status" data-symbol="${pos.symbol}" data-strike="${pos.strike_price}" data-cp="${pos.call_put}">Loading...</span>
                                </div>
                                <div style="flex: 1;">
                                    <span style="color: #94a3b8;">Cash Required:</span>
                                    <span style="color: #ffffff;">${legCashRequired ? formatCurrency(legCashRequired) : '-'}</span>
                                </div>
                                <div style="flex: 1;">
                                    <span style="color: #94a3b8;">Open Price:</span>
                                    <span style="color: #ffffff;">${openPrice}</span>
                                </div>
                                ${legIbDetailsHtml}
                            </div>
                        </div>
                    `;
                });
                
                let campaignBannerHtml = '';
                if ((firstPos.campaign_realized_pnl && firstPos.campaign_realized_pnl !== 0) || (firstPos.roll_count && firstPos.roll_count > 0)) {
                    const cSign = (firstPos.campaign_realized_pnl || 0) >= 0 ? '+' : '';
                    const cClass = (firstPos.campaign_realized_pnl || 0) >= 0 ? 'pnl-positive' : 'pnl-negative';
                    campaignBannerHtml = `
                        <div class="campaign-summary-banner">
                            <div>
                                <span>🔄 Campaign Tracking (Roll #${firstPos.roll_count || 0})</span>
                            </div>
                            <div>
                                <span>Realized P&L so far: </span>
                                <span class="campaign-summary-pnl ${cClass}">${cSign}${formatCurrency(firstPos.campaign_realized_pnl || 0)}</span>
                                <a href="details?group_id=${firstPos.group_id}" target="_blank" class="btn-icon-small" title="View Full Campaign History">History &rarr;</a>
                            </div>
                        </div>
                    `;
                }

                detailsTr.innerHTML = `
                    <td colspan="7">
                        <div class="details-content-v2" style="background: rgba(255, 255, 255, 0.02); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); margin: 5px 0;">
                            <div style="margin-bottom: 10px; font-weight: bold;">
                                Current Underlying Price: 
                                <span class="price-val" data-symbol="${firstPos.symbol}">Loading...</span>
                            </div>
                            <div class="drawer-legs-container">
                                ${detailsLegsHtml}
                            </div>
                            ${campaignBannerHtml}
                        </div>
                    </td>
                `;
                
                tbody.appendChild(detailsTr);
            });
            
            // Footer update (moved inside since totalAR is scoped here)
            const riskFooter = document.getElementById('total-open-risk');
            riskFooter.innerHTML = `
                <div style="color: var(--danger-color); font-weight: bold;">${formatCurrency(totalRisk)}</div>
                <div style="font-size: 0.8rem; color: #94a3b8; font-weight: normal; margin-top: 2px;">
                    ${formatCurrency(totalAR)}
                </div>
            `;
        } else {
            groupList.forEach(group => {
                const firstPos = group[0];
                const isSpread = group.length > 1;
                
                let groupTotalValue = group.reduce((sum, p) => sum + p.realized_pnl_usd, 0);
                totalUsd += groupTotalValue;

                // Create Main Row
                const tr = document.createElement('tr');
                
                // 1. Column: Underlying (Symbol)
                const underlyingLink = `<a href="details?group_id=${firstPos.group_id}" target="_blank" class="symbol-link-v2" title="View Full Details">${firstPos.symbol}</a>`;
                
                // 2. Column: Strategy Legs
                let legsHtml = '';
                group.forEach(pos => {
                    const openTrans = pos.transactions.find(t => t.transaction_type === 'BTO' || t.transaction_type === 'STO');
                    const closeTrans = pos.transactions.filter(t => t.transaction_type !== 'BTO' && t.transaction_type !== 'STO').pop();
                    
                    let outcomeBadgeHtml = '';
                    if (pos.outcome === 'EXPIRED' || (closeTrans && closeTrans.transaction_type === 'EXP')) {
                        outcomeBadgeHtml = `<span class="badge badge-exp">[EXP]</span>`;
                    } else if (pos.outcome === 'CALLED_AWAY') {
                        outcomeBadgeHtml = `<span class="badge badge-assigned">[CALLED AWAY]</span>`;
                    } else if (pos.outcome === 'ASSIGNED' || (closeTrans && closeTrans.transaction_type === 'ASSIGN')) {
                        outcomeBadgeHtml = `<span class="badge badge-assigned">[ASSIGNED]</span>`;
                    } else if (pos.outcome === 'EXERCISED' || (closeTrans && closeTrans.transaction_type === 'EXERCISE')) {
                        outcomeBadgeHtml = `<span class="badge badge-exercised">[EXERCISED]</span>`;
                    } else {
                        const closeType = closeTrans ? closeTrans.transaction_type : (pos.initial_type === 'STO' ? 'BTC' : 'STC');
                        const typeClass = closeType === 'BTC' ? 'leg-type-btc' : 'leg-type-stc';
                        outcomeBadgeHtml = `<span class="${typeClass}">[${closeType}]</span>`;
                    }

                    const dateOpened = formatDate(pos.date_opened);
                    const dateClosed = closeTrans ? formatDate(closeTrans.date) : '-';
                    
                    const occ = pos.occ_symbol || '';
                    let rollBadgeHtml = '';
                    if (pos.roll_count && pos.roll_count > 0) {
                        rollBadgeHtml = `<span class="badge-roll" title="Roll #${pos.roll_count}">Roll #${pos.roll_count}</span>`;
                    }
                    legsHtml += `
                        <div class="strategy-leg-item">
                            ${outcomeBadgeHtml}
                            <span class="leg-contract-name" style="color: #38bdf8; font-weight: 500;" title="OCC Symbol: ${occ}">${pos.contract_name}</span>
                            ${rollBadgeHtml}
                            <span class="leg-date-range">(${dateOpened} to ${dateClosed})</span>
                        </div>
                    `;
                });
                legsHtml = `<div class="legs-wrapper">${legsHtml}</div>`;
                
                // 3. Column: Date Closed & Hold Time
                const closeTransDates = group.flatMap(p => p.transactions)
                    .filter(t => t.transaction_type !== 'BTO' && t.transaction_type !== 'STO')
                    .map(t => new Date(t.date).getTime())
                    .filter(t => !isNaN(t));
                const latestCloseDate = closeTransDates.length > 0 ? new Date(Math.max(...closeTransDates)) : null;
                const dateClosedStr = latestCloseDate ? formatDate(latestCloseDate.toISOString()) : '-';
                const holdTimeStr = (latestCloseDate && firstPos.date_opened) 
                    ? calculateHoldTime(firstPos.date_opened, latestCloseDate.toISOString()) 
                    : '-';
                
                // 4. Column: Realized P/L
                const sign = groupTotalValue > 0 ? '+' : '';
                const pnlClass = groupTotalValue > 0 ? 'pnl-positive' : (groupTotalValue < 0 ? 'pnl-negative' : '');
                const realizedPnLHtml = `<span class="${pnlClass}" style="font-weight: bold;">${sign}${formatCurrency(groupTotalValue)}</span>`;
                
                // 5. Column: Actions
                let actionsHtml = '';
                const detailsUrl = `details?group_id=${firstPos.group_id}`;
                if (isSpread) {
                    actionsHtml = `
                        <button class="btn-icon btn-toggle-drawer" title="Toggle Legs Drawer (ℹ️)" onclick="toggleDetails(this, '${firstPos.group_id}')">ℹ️</button>
                        <button class="btn-action-pill btn-reopen" title="Reopen / Undo Close Group" onclick="reopenGroup('${firstPos.group_id}')">↩️ Reopen</button>
                        <div class="action-menu-dropdown">
                            <button class="btn-icon btn-action-more" title="More Options" onclick="toggleActionMenu(event, this)">•••</button>
                            <div class="action-menu-popover" style="display: none;">
                                <button class="action-menu-item" onclick="openGroupEditModal('${firstPos.group_id}')">✏️ Edit Group</button>
                                <a class="action-menu-item" href="${detailsUrl}" target="_blank">🔗 Strategy Details</a>
                                <div class="action-menu-divider"></div>
                                <button class="action-menu-item item-danger" onclick="deleteGroup('${firstPos.group_id}')">🗑️ Delete Group</button>
                            </div>
                        </div>
                    `;
                } else {
                    actionsHtml = `
                        <button class="btn-icon btn-toggle-drawer" title="Toggle Legs Drawer (ℹ️)" onclick="toggleDetails(this, '${firstPos.group_id}')">ℹ️</button>
                        <button class="btn-action-pill btn-reopen" title="Reopen / Undo Close Position" onclick="reopenPosition(${firstPos.id})">↩️ Reopen</button>
                        <div class="action-menu-dropdown">
                            <button class="btn-icon btn-action-more" title="More Options" onclick="toggleActionMenu(event, this)">•••</button>
                            <div class="action-menu-popover" style="display: none;">
                                <button class="action-menu-item" onclick="openEditModal(${firstPos.id})">✏️ Edit Position</button>
                                <a class="action-menu-item" href="${detailsUrl}" target="_blank">🔗 Strategy Details</a>
                                <div class="action-menu-divider"></div>
                                <button class="action-menu-item item-danger" onclick="deletePosition(${firstPos.id})">🗑️ Delete Position</button>
                            </div>
                        </div>
                    `;
                }
                
                tr.innerHTML = `
                    <td class="cell-legs" data-label="Position">
                        <div class="position-underlying-header">${underlyingLink}</div>
                        ${legsHtml}
                    </td>
                    <td class="cell-date-closed" data-label="Date Closed" style="vertical-align: middle;">${dateClosedStr}</td>
                    <td data-label="Hold Time" style="vertical-align: middle; font-weight: bold; color: #ffffff;">${holdTimeStr}</td>
                    <td data-label="Realized P/L" style="vertical-align: middle;">${realizedPnLHtml}</td>
                    <td class="action-cell" data-label="Actions"><div class="action-cell-inner">${actionsHtml}</div></td>
                `;
                
                tbody.appendChild(tr);
                
                // Create details drawer row spanning 5 columns
                const detailsTr = document.createElement('tr');
                detailsTr.className = `details-row pos-details-${firstPos.group_id}`;
                detailsTr.style.display = 'none';
                
                let detailsLegsHtml = '';
                group.forEach(pos => {
                    const openTrans = pos.transactions.find(t => t.transaction_type === 'BTO' || t.transaction_type === 'STO');
                    const closeTrans = pos.transactions.filter(t => t.transaction_type !== 'BTO' && t.transaction_type !== 'STO').pop();
                    
                    const openPrice = openTrans ? formatCurrency(openTrans.option_price) : '-';
                    const closePrice = closeTrans ? formatCurrency(closeTrans.option_price) : '-';
                    const openComm = openTrans ? formatCurrency(openTrans.commission) : '0.00';
                    const closeComm = closeTrans ? formatCurrency(closeTrans.commission) : '0.00';
                    
                    const occ = pos.occ_symbol || '';

                    let deliveryMemoHtml = '';
                    if (pos.outcome === 'ASSIGNED' || pos.outcome === 'CALLED_AWAY' || pos.outcome === 'EXERCISED') {
                        const isDelivering = (pos.initial_type === 'STO' && pos.call_put === 'Call') || (pos.initial_type === 'BTO' && pos.call_put === 'Put');
                        const sharesTotal = pos.current_quantity * (pos.multiplier || 100);
                        const shareText = isDelivering 
                            ? `-${sharesTotal}x ${pos.symbol} (Sold / Delivered)` 
                            : `+${sharesTotal}x ${pos.symbol} (Acquired / Bought)`;
                        const metricLabel = isDelivering ? 'Effective Sale:' : 'Effective Basis:';
                        const basisText = pos.effective_stock_basis ? `$${formatCurrency(pos.effective_stock_basis)}/sh` : '-';
                        const memoTitle = pos.outcome === 'CALLED_AWAY' 
                            ? '📦 Delivery Memo (Shares Called Away)' 
                            : (pos.outcome === 'EXERCISED' 
                                ? (pos.call_put === 'Put' ? '📦 Delivery Memo (Put Exercised)' : '📦 Delivery Memo (Call Exercised)')
                                : '📦 Delivery Memo (Stock Assignment)');

                        deliveryMemoHtml = `
                            <div class="delivery-memo-banner" style="margin-top: 10px;">
                                <div class="delivery-memo-title">${memoTitle}</div>
                                <div class="delivery-memo-grid">
                                    <div class="delivery-memo-item"><span class="delivery-memo-label">Shares:</span> ${shareText}</div>
                                    <div class="delivery-memo-item"><span class="delivery-memo-label">Strike:</span> $${formatCurrency(pos.strike_price)}</div>
                                    <div class="delivery-memo-item"><span class="delivery-memo-label">${metricLabel}</span> <strong>${basisText}</strong></div>
                                    ${pos.close_notes ? `<div class="delivery-memo-item" style="grid-column: 1 / -1;"><span class="delivery-memo-label">Notes:</span> ${pos.close_notes}</div>` : ''}
                                </div>
                            </div>
                        `;
                    }

                    detailsLegsHtml += `
                        <div class="drawer-leg-item" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 8px 0;">
                            <div style="font-weight: bold; color: #ffffff; margin-bottom: 4px;">
                                ${pos.initial_type} ${pos.current_quantity}x ${pos.contract_name}
                                <span style="font-size: 0.8rem; font-family: monospace; color: #64748b; margin-left: 10px;">(${occ})</span>
                                <button class="btn-icon-small" title="Reopen / Undo close for this leg" onclick="reopenPosition(${pos.id})">↩️ Reopen Leg</button>
                            </div>
                            <div style="display: flex; gap: 20px; font-size: 0.9rem;">
                                <div>
                                    <span style="color: #94a3b8;">Open Price:</span>
                                    <span style="color: #ffffff;">${openPrice} (Comm: ${openComm})</span>
                                </div>
                                <div>
                                    <span style="color: #94a3b8;">Close Price:</span>
                                    <span style="color: #ffffff;">${closePrice} (Comm: ${closeComm})</span>
                                </div>
                                <div>
                                    <span style="color: #94a3b8;">Realized P/L:</span>
                                    <span class="${pos.realized_pnl_usd >= 0 ? 'pnl-positive' : 'pnl-negative'}" style="font-weight: bold;">
                                        ${pos.realized_pnl_usd >= 0 ? '+' : ''}${formatCurrency(pos.realized_pnl_usd)}
                                    </span>
                                </div>
                            </div>
                            ${deliveryMemoHtml}
                        </div>
                    `;
                });
                
                let campaignBannerHtml = '';
                if ((firstPos.campaign_realized_pnl && firstPos.campaign_realized_pnl !== 0) || (firstPos.roll_count && firstPos.roll_count > 0)) {
                    const cSign = (firstPos.campaign_realized_pnl || 0) >= 0 ? '+' : '';
                    const cClass = (firstPos.campaign_realized_pnl || 0) >= 0 ? 'pnl-positive' : 'pnl-negative';
                    campaignBannerHtml = `
                        <div class="campaign-summary-banner">
                            <div>
                                <span>🔄 Campaign Tracking (Roll #${firstPos.roll_count || 0})</span>
                            </div>
                            <div>
                                <span>Total Campaign Realized P&L: </span>
                                <span class="campaign-summary-pnl ${cClass}">${cSign}${formatCurrency(firstPos.campaign_realized_pnl || 0)}</span>
                                <a href="details?group_id=${firstPos.group_id}" target="_blank" class="btn-icon-small" title="View Full Campaign History">History &rarr;</a>
                            </div>
                        </div>
                    `;
                }

                detailsTr.innerHTML = `
                    <td colspan="5">
                        <div class="details-content-v2" style="background: rgba(255, 255, 255, 0.02); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); margin: 5px 0;">
                            <div class="drawer-legs-container">
                                ${detailsLegsHtml}
                            </div>
                            ${campaignBannerHtml}
                        </div>
                    </td>
                `;
                tbody.appendChild(detailsTr);
            });
        }

        if (status === 'Open') {
            const usdFooter = document.getElementById('total-open-usd');
            let ibTotalHtml = '';
            if (anyIbData) {
                const totalIbClass = totalIbUnrealized >= 0 ? 'ib-pnl-pos' : 'ib-pnl-neg';
                const totalIbSign = totalIbUnrealized > 0 ? '+' : '';
                
                const totalIbPercent = Math.abs(totalUsd) > 0 ? (totalIbUnrealized / Math.abs(totalUsd)) * 100 : 0;
                const totalIbPercentDisplay = totalIbPercent !== 0 
                    ? ` (${totalIbPercent > 0 ? '+' : ''}${totalIbPercent.toFixed(2)}%)` 
                    : '';
                
                ibTotalHtml = `
                    <div style="font-size: 0.8rem; font-weight: normal; margin-top: 2px;">
                        IB P/L: <span class="${totalIbClass}">${totalIbSign}${formatCurrency(totalIbUnrealized)}${totalIbPercentDisplay}</span>
                    </div>
                `;
            }
            
            usdFooter.innerHTML = `
                <div class="${totalUsd >= 0 ? 'pnl-positive' : 'pnl-negative'}" style="font-weight: bold;">
                    ${formatCurrency(totalUsd)}
                </div>
                ${ibTotalHtml}
            `;
            
            fetchCurrentPrices();
        } else {
            const usdFooter = document.getElementById('total-closed-usd');
            usdFooter.textContent = formatCurrency(totalUsd);
            usdFooter.className = totalUsd >= 0 ? 'pnl-positive' : 'pnl-negative';
        }
    }

    // Global toggle event delegation
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('toggle-icon')) {
            const targetClass = e.target.getAttribute('data-target');
            const targetRows = document.querySelectorAll(`.${targetClass}`);
            const isHidden = targetRows[0].style.display === 'none';
            
            targetRows.forEach(row => {
                row.style.display = isHidden ? 'table-row' : 'none';
            });
            e.target.textContent = isHidden ? '[-]' : '[+]';
        }
    });

    formNew.addEventListener('submit', async (e) => {
        e.preventDefault();
        const legs = [];
        legsContainer.querySelectorAll('.leg-entry').forEach(div => {
            legs.push({
                contract_name: div.querySelector('.leg-contract').value,
                strike_price: parseFloat(div.querySelector('.leg-strike').value),
                call_put: div.querySelector('.leg-cp').value,
                transaction_type: div.querySelector('.leg-type').value,
                option_price: parseFloat(div.querySelector('.leg-price').value),
                commission: parseFloat(div.querySelector('.leg-comm').value),
                total_usd: parseFloat(div.querySelector('.leg-usd').value)
            });
        });

        const maxLossStr = document.getElementById('new-max-loss').value.replace(/,/g, '');
        const data = {
            symbol: document.getElementById('new-symbol').value,
            date_opened: document.getElementById('new-date').value + "T00:00:00",
            expiration_date: globalExpInput.value + "T00:00:00",
            quantity: parseInt(globalQtyInput.value),
            multiplier: parseFloat(globalMultiplierInput.value) || 100,
            max_loss: parseFloat(maxLossStr) || 0,
            legs: legs
        };

        const response = await fetch('api/positions/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            modalNew.style.display = 'none';
            formNew.reset();
            loadPositions('Open');
        }
    });

    function calculateEditMaxLoss() {
        const overrideCheckbox = document.getElementById('edit-override-max-loss');
        const maxLossInput = document.getElementById('edit-max-loss');
        const isOverridden = overrideCheckbox && overrideCheckbox.checked;
        setMaxLossInputState(maxLossInput, isOverridden);

        const type = document.getElementById('edit-type').value;
        const cp = document.getElementById('edit-cp').value;
        const strike = parseFloat(document.getElementById('edit-strike').value) || 0;
        const multiplier = parseFloat(document.getElementById('edit-multiplier').value) || 100;
        const netQty = parseInt(document.getElementById('edit-qty').value) || 1;

        const openPrice = parseFloat(document.getElementById('edit-open-price')?.value) || 0;
        const openComm = parseFloat(document.getElementById('edit-open-comm')?.value) || 0;
        
        let openTotal = netQty * openPrice * multiplier;
        let openingTotalUsd = 0;
        if (type === 'BTO' || type === 'BTC') {
            openingTotalUsd = -(openTotal + openComm);
        } else {
            openingTotalUsd = openTotal - openComm;
        }

        const openDisplay = document.getElementById('edit-open-total-display');
        if (openDisplay) {
            const openSign = openingTotalUsd >= 0 ? '+' : '';
            openDisplay.textContent = `${openSign}${formatCurrency(openingTotalUsd)}`;
            openDisplay.className = `roll-total-val ${openingTotalUsd >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
        }

        let grandTotal = openingTotalUsd;
        document.querySelectorAll('.edit-close-trans-row').forEach(row => {
            const cType = row.querySelector('.edit-close-type').value;
            const cPrice = parseFloat(row.querySelector('.edit-close-price').value) || 0;
            const cComm = parseFloat(row.querySelector('.edit-close-comm').value) || 0;
            let cTotal = netQty * cPrice * multiplier;
            let cUsd = 0;
            if (cType === 'BTO' || cType === 'BTC') {
                cUsd = -(cTotal + cComm);
            } else if (cType === 'EXP' || cType === 'ASSIGN' || cType === 'EXERCISE') {
                cUsd = -cComm;
            } else {
                cUsd = cTotal - cComm;
            }
            row.querySelector('.edit-close-total-usd').value = cUsd.toFixed(2);
            const cSign = cUsd >= 0 ? '+' : '';
            const cDisplay = row.querySelector('.edit-close-total-display');
            if (cDisplay) {
                cDisplay.textContent = `${cSign}${formatCurrency(cUsd)}`;
                cDisplay.className = `roll-total-val ${cUsd >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
            }
            grandTotal += cUsd;
        });

        document.getElementById('edit-total-usd').value = grandTotal.toFixed(2);
        const editSummaryEl = document.getElementById('edit-summary-total');
        if (editSummaryEl) {
            editSummaryEl.textContent = `${grandTotal >= 0 ? '+' : ''}${formatCurrency(grandTotal)}`;
            editSummaryEl.className = `group-roll-stat-val ${grandTotal >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
        }

        let maxLoss = 0;
        let breakeven = 0;
        const netPremiumPerShare = Math.abs(openingTotalUsd / multiplier / (netQty || 1));

        if (netQty <= 0) {
            maxLoss = 0;
        } else if (type === 'STO' && cp === 'Put') {
            maxLoss = Math.max(0, (strike * multiplier * netQty) - openingTotalUsd);
            breakeven = strike - netPremiumPerShare;
        } else if (type === 'BTO' && cp === 'Put') {
            maxLoss = Math.max(0, -openingTotalUsd);
            breakeven = strike - netPremiumPerShare;
        } else if (type === 'STO' && cp === 'Call') {
            maxLoss = 0;
            breakeven = strike + netPremiumPerShare;
        } else if (type === 'BTO' && cp === 'Call') {
            maxLoss = Math.max(0, -openingTotalUsd);
            breakeven = strike + netPremiumPerShare;
        }
        
        if (!isOverridden) {
            maxLossInput.value = formatCurrency(maxLoss);
        }
        const beEl = document.getElementById('edit-breakeven');
        if (beEl) {
            beEl.textContent = breakeven > 0 ? formatCurrency(breakeven) : '-';
        }
    }

    window.openEditModal = async (id) => {
        const response = await fetch(`api/positions/${id}`);
        if (!response.ok) return;
        const pos = await response.json();
        
        const idx = allPositions.findIndex(p => p.id === id);
        if (idx !== -1) allPositions[idx] = pos;

        const infoEl = document.getElementById('edit-info-summary');
        if (infoEl) {
            const reopenBtnHtml = pos.status === 'Closed'
                ? `<button type="button" class="btn-icon-small" style="margin-left: 12px; background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; cursor: pointer; padding: 2px 8px; border-radius: 4px;" onclick="reopenPosition(${pos.id})">↩️ Reopen Position</button>`
                : '';
            infoEl.innerHTML = `
                <span class="roll-summary-badge">${pos.symbol}</span>
                Editing <strong>${pos.contract_name}</strong> (${pos.current_quantity}x) &bull; Status: <span class="badge ${pos.status.toLowerCase()}">${pos.status}</span>
                ${reopenBtnHtml}
            `;
        }

        document.getElementById('edit-pos-id').value = pos.id;
        document.getElementById('edit-symbol').value = pos.symbol;
        document.getElementById('edit-date').value = pos.date_opened.split('T')[0];
        document.getElementById('edit-exp-date').value = pos.expiration_date ? pos.expiration_date.split('T')[0] : '';
        document.getElementById('edit-qty').value = pos.current_quantity;
        document.getElementById('edit-multiplier').value = pos.multiplier;
        document.getElementById('edit-contract').value = pos.contract_name;
        document.getElementById('edit-strike').value = pos.strike_price || 0;
        document.getElementById('edit-cp').value = pos.call_put || 'Put';
        document.getElementById('edit-type').value = pos.initial_type;
        document.getElementById('edit-total-usd').value = Number(pos.total_cost_usd || 0).toFixed(2);
        
        const editOverrideCheckbox = document.getElementById('edit-override-max-loss');
        const editMaxLossInput = document.getElementById('edit-max-loss');
        const savedMaxLoss = pos.max_loss !== undefined && pos.max_loss !== null ? pos.max_loss : null;
        if (editOverrideCheckbox) editOverrideCheckbox.checked = false;
        setMaxLossInputState(editMaxLossInput, false);
        editMaxLossInput.value = (savedMaxLoss !== null && savedMaxLoss !== 999999) ? formatCurrency(savedMaxLoss) : '0.00';
        
        const openTrans = pos.transactions.find(t => t.transaction_type === 'BTO' || t.transaction_type === 'STO');
        const openPriceInput = document.getElementById('edit-open-price');
        const openCommInput = document.getElementById('edit-open-comm');
        const openTotalDisplay = document.getElementById('edit-open-total-display');

        if (openTrans) {
            openPriceInput.value = openTrans.option_price;
            openCommInput.value = openTrans.commission;
            openTotalDisplay.dataset.transId = openTrans.id;
        } else {
            openPriceInput.value = '0.00';
            openCommInput.value = '0.00';
            delete openTotalDisplay.dataset.transId;
        }

        const closeTrans = pos.transactions.filter(t => t.transaction_type !== 'BTO' && t.transaction_type !== 'STO');
        const closeSection = document.getElementById('edit-single-closing-section');
        const closeTbody = document.getElementById('edit-single-closing-tbody');
        closeTbody.innerHTML = '';
        if (closeTrans.length > 0) {
            closeSection.style.display = 'block';
            closeTrans.forEach(t => {
                const tr = document.createElement('tr');
                tr.className = 'roll-leg-row edit-close-trans-row';
                tr.dataset.transId = t.id;
                tr.innerHTML = `
                    <td><input type="date" class="roll-input edit-close-date" value="${t.date.split('T')[0]}" required></td>
                    <td>
                        <select class="roll-select edit-close-type">
                            <option value="BTC" ${t.transaction_type === 'BTC' ? 'selected' : ''}>BTC</option>
                            <option value="STC" ${t.transaction_type === 'STC' ? 'selected' : ''}>STC</option>
                            <option value="EXP" ${t.transaction_type === 'EXP' ? 'selected' : ''}>EXP</option>
                            <option value="ASSIGN" ${t.transaction_type === 'ASSIGN' ? 'selected' : ''}>ASSIGN</option>
                            <option value="EXERCISE" ${t.transaction_type === 'EXERCISE' ? 'selected' : ''}>EXERCISE</option>
                        </select>
                    </td>
                    <td><input type="number" class="roll-input edit-close-price" step="any" value="${t.option_price}" required></td>
                    <td><input type="number" class="roll-input edit-close-comm" step="any" value="${t.commission}"></td>
                    <td><span class="roll-total-val edit-close-total-display">${formatCurrency(t.total_usd)}</span><input type="hidden" class="edit-close-total-usd" value="${t.total_usd}"></td>
                    <td style="text-align: center;"><button type="button" class="btn-icon-small" title="Delete this closing transaction and reopen position" onclick="deleteClosingTransaction(${t.id}, ${pos.id})">❌</button></td>
                `;
                closeTbody.appendChild(tr);

                tr.querySelectorAll('input, select').forEach(el => {
                    el.addEventListener('input', calculateEditMaxLoss);
                    el.addEventListener('change', calculateEditMaxLoss);
                });
            });
        } else {
            closeSection.style.display = 'none';
        }

        calculateEditMaxLoss();
        if (savedMaxLoss !== null && savedMaxLoss !== 999999) {
            editMaxLossInput.value = formatCurrency(savedMaxLoss);
        }
        modalEdit.style.display = 'block';
    };

    const editOverrideCheckboxEl = document.getElementById('edit-override-max-loss');
    if (editOverrideCheckboxEl) {
        editOverrideCheckboxEl.addEventListener('change', () => {
            calculateEditMaxLoss();
            if (editOverrideCheckboxEl.checked) {
                document.getElementById('edit-max-loss').focus();
            }
        });
    }

    ['edit-qty', 'edit-strike', 'edit-cp', 'edit-type', 'edit-multiplier', 'edit-open-price', 'edit-open-comm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                if (id === 'edit-strike' || id === 'edit-cp' || id === 'edit-exp-date') {
                    const expVal = document.getElementById('edit-exp-date').value;
                    const strikeVal = document.getElementById('edit-strike').value;
                    const cpVal = document.getElementById('edit-cp').value;
                    const symbolVal = document.getElementById('edit-symbol').value;
                    const autoName = formatContractName(expVal, strikeVal, cpVal, symbolVal);
                    if (autoName) document.getElementById('edit-contract').value = autoName;
                }
                calculateEditMaxLoss();
            });
        }
    });

    formEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-pos-id').value;

        // Update opening transaction
        const openTotalDisplay = document.getElementById('edit-open-total-display');
        const openTransId = openTotalDisplay?.dataset?.transId;
        const qty = parseInt(document.getElementById('edit-qty').value) || 1;
        const multiplier = parseFloat(document.getElementById('edit-multiplier').value) || 100;
        const type = document.getElementById('edit-type').value;

        if (openTransId) {
            const openPrice = parseFloat(document.getElementById('edit-open-price').value) || 0;
            const openComm = parseFloat(document.getElementById('edit-open-comm').value) || 0;
            let total = qty * openPrice * multiplier;
            let totalUsd = (type === 'BTO') ? -(total + openComm) : (total - openComm);
            await fetch(`api/transactions/${openTransId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: document.getElementById('edit-date').value + "T00:00:00",
                    transaction_type: type,
                    quantity: qty,
                    option_price: openPrice,
                    commission: openComm,
                    total_usd: totalUsd
                })
            });
        }

        // Update closing transactions
        const closeRows = document.querySelectorAll('.edit-close-trans-row');
        for (const row of closeRows) {
            const transId = row.dataset.transId;
            const tData = {
                date: row.querySelector('.edit-close-date').value + "T00:00:00",
                transaction_type: row.querySelector('.edit-close-type').value,
                quantity: qty,
                option_price: parseFloat(row.querySelector('.edit-close-price').value) || 0,
                commission: parseFloat(row.querySelector('.edit-close-comm').value) || 0,
                total_usd: parseFloat(row.querySelector('.edit-close-total-usd').value) || 0
            };
            await fetch(`api/transactions/${transId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tData)
            });
        }

        const maxLossStr = document.getElementById('edit-max-loss').value.replace(/,/g, '');
        const posData = {
            symbol: document.getElementById('edit-symbol').value,
            date_opened: document.getElementById('edit-date').value + "T00:00:00",
            expiration_date: document.getElementById('edit-exp-date').value + "T00:00:00",
            contract_name: document.getElementById('edit-contract').value,
            strike_price: parseFloat(document.getElementById('edit-strike').value),
            call_put: document.getElementById('edit-cp').value,
            initial_type: document.getElementById('edit-type').value,
            multiplier: multiplier,
            max_loss: parseFloat(maxLossStr) || 0
        };

        const response = await fetch(`api/positions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(posData)
        });

        if (response.ok) {
            modalEdit.style.display = 'none';
            loadPositions(currentStatus);
        }
    });

    let currentClosePos = null;

    window.openCloseModal = (id, initialType, currentQty) => {
        const pos = allPositions.find(p => p.id === parseInt(id));
        if (!pos) return;
        currentClosePos = pos;

        const origPrice = getOriginalPrice(pos);
        const origPriceStr = origPrice > 0 ? Number(origPrice).toFixed(2) : '';

        document.getElementById('close-pos-id').value = pos.id;
        document.getElementById('close-info-summary').innerHTML = `
            <span class="roll-summary-badge">${pos.symbol}</span>
            Closing <strong>${pos.contract_name}</strong> (${currentQty}x)${origPriceStr ? ` &bull; Opened @ <strong>$${origPriceStr}</strong> (${pos.initial_type})` : ''}
        `;
        document.getElementById('close-date').valueAsDate = new Date();

        const singleContractEl = document.getElementById('single-close-contract');
        if (singleContractEl) singleContractEl.textContent = pos.contract_name;

        const closeType = (initialType === 'BTO' || initialType === 'BTC') ? 'STC' : 'BTC';
        document.getElementById('close-type').value = closeType;

        const isShort = pos.initial_type === 'STO';
        const isCall = pos.call_put === 'Call';
        const assignBtn = document.getElementById('btn-close-method-assigned');
        if (assignBtn) {
            if (isShort && isCall) {
                assignBtn.textContent = '📦 Called Away @ Strike';
                assignBtn.dataset.method = 'CALLED_AWAY';
            } else if (isShort) {
                assignBtn.textContent = '📦 Assigned @ Strike';
                assignBtn.dataset.method = 'ASSIGNED';
            } else {
                assignBtn.textContent = '📦 Exercised @ Strike';
                assignBtn.dataset.method = 'EXERCISED';
            }
        }

        // Reset Method Selector to TRADED
        document.querySelectorAll('#close-method-selector .btn-method').forEach(btn => btn.classList.remove('active'));
        const tradeBtn = document.querySelector('#close-method-selector [data-method="TRADED"]');
        if (tradeBtn) tradeBtn.classList.add('active');

        document.getElementById('close-outcome').value = 'TRADED';
        document.getElementById('close-effective-basis').value = '';
        document.getElementById('close-notes').value = '';

        const actionsEl = document.getElementById('single-close-actions');
        if (actionsEl) {
            actionsEl.innerHTML = `
                <span class="badge ${pos.initial_type.toLowerCase()}">${pos.initial_type}${origPriceStr ? ` @ $${origPriceStr}` : ''}</span>
                <span class="roll-arrow-icon">&rarr;</span>
                <span class="badge ${closeType.toLowerCase()}">${closeType}</span>
            `;
        }

        document.getElementById('close-qty').value = currentQty;
        document.getElementById('close-qty').max = currentQty;

        const defaultClosePrice = (pos.ib_current_price !== null && pos.ib_current_price !== undefined) 
            ? Number(pos.ib_current_price).toFixed(2) 
            : '';
        closePriceInput.value = defaultClosePrice;
        closePriceInput.placeholder = '0.00';
        closePriceInput.readOnly = false;
        closePriceInput.classList.remove('input-readonly');
        closeCommInput.value = "0.00";
        closeCommInput.readOnly = false;
        closeCommInput.classList.remove('input-readonly');

        const memoEl = document.getElementById('close-delivery-memo');
        if (memoEl) memoEl.style.display = 'none';

        calculateCloseTotal();
        modalClose.style.display = 'block';
    };

    // Close Method Selector Button Handler
    const setupCloseMethodSelector = () => {
        const selectorEl = document.getElementById('close-method-selector');
        if (!selectorEl) return;
        selectorEl.querySelectorAll('.btn-method').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!currentClosePos) return;
                selectorEl.querySelectorAll('.btn-method').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const method = btn.dataset.method;
                const pos = currentClosePos;
                const origPrice = getOriginalPrice(pos) || 0;
                const origPriceStr = origPrice > 0 ? Number(origPrice).toFixed(2) : '';
                const isShort = pos.initial_type === 'STO';
                const actionsEl = document.getElementById('single-close-actions');
                const memoEl = document.getElementById('close-delivery-memo');

                if (method === 'TRADED') {
                    document.getElementById('close-outcome').value = 'TRADED';
                    const closeType = isShort ? 'BTC' : 'STC';
                    document.getElementById('close-type').value = closeType;
                    if (actionsEl) {
                        actionsEl.innerHTML = `
                            <span class="badge ${pos.initial_type.toLowerCase()}">${pos.initial_type}${origPriceStr ? ` @ $${origPriceStr}` : ''}</span>
                            <span class="roll-arrow-icon">&rarr;</span>
                            <span class="badge ${closeType.toLowerCase()}">${closeType}</span>
                        `;
                    }
                    closePriceInput.readOnly = false;
                    closePriceInput.classList.remove('input-readonly');
                    const defaultClosePrice = (pos.ib_current_price !== null && pos.ib_current_price !== undefined) 
                        ? Number(pos.ib_current_price).toFixed(2) 
                        : '';
                    closePriceInput.value = defaultClosePrice;
                    closeCommInput.readOnly = false;
                    closeCommInput.classList.remove('input-readonly');
                    if (memoEl) memoEl.style.display = 'none';
                    document.getElementById('close-effective-basis').value = '';
                    document.getElementById('close-notes').value = '';
                } else if (method === 'EXPIRED') {
                    document.getElementById('close-outcome').value = 'EXPIRED';
                    document.getElementById('close-type').value = 'EXP';
                    if (actionsEl) {
                        actionsEl.innerHTML = `
                            <span class="badge ${pos.initial_type.toLowerCase()}">${pos.initial_type}${origPriceStr ? ` @ $${origPriceStr}` : ''}</span>
                            <span class="roll-arrow-icon">&rarr;</span>
                            <span class="badge badge-exp">EXPIRED</span>
                        `;
                    }
                    closePriceInput.value = '0.00';
                    closePriceInput.readOnly = true;
                    closePriceInput.classList.add('input-readonly');
                    closeCommInput.value = '0.00';
                    closeCommInput.readOnly = true;
                    closeCommInput.classList.add('input-readonly');
                    if (memoEl) memoEl.style.display = 'none';
                    document.getElementById('close-effective-basis').value = '';
                    document.getElementById('close-notes').value = 'Expired worthless';
                } else if (method === 'ASSIGNED' || method === 'CALLED_AWAY' || method === 'EXERCISED') {
                    const isShort = pos.initial_type === 'STO';
                    const isCall = pos.call_put === 'Call';
                    let outcome = 'ASSIGNED';
                    let closeType = 'ASSIGN';
                    let badgeLabel = 'ASSIGNED';
                    let memoTitle = '📦 Delivery Memo (Stock Assignment)';
                    let isDelivering = false;

                    if (isShort && isCall) {
                        outcome = 'CALLED_AWAY';
                        closeType = 'ASSIGN';
                        badgeLabel = 'CALLED AWAY';
                        memoTitle = '📦 Delivery Memo (Shares Called Away)';
                        isDelivering = true;
                    } else if (isShort && !isCall) {
                        outcome = 'ASSIGNED';
                        closeType = 'ASSIGN';
                        badgeLabel = 'ASSIGNED';
                        memoTitle = '📦 Delivery Memo (Stock Assignment)';
                        isDelivering = false;
                    } else if (!isShort && isCall) {
                        outcome = 'EXERCISED';
                        closeType = 'EXERCISE';
                        badgeLabel = 'EXERCISED';
                        memoTitle = '📦 Delivery Memo (Call Exercised)';
                        isDelivering = false;
                    } else { // Long Put
                        outcome = 'EXERCISED';
                        closeType = 'EXERCISE';
                        badgeLabel = 'EXERCISED';
                        memoTitle = '📦 Delivery Memo (Put Exercised)';
                        isDelivering = true;
                    }

                    document.getElementById('close-outcome').value = outcome;
                    document.getElementById('close-type').value = closeType;
                    if (actionsEl) {
                        const badgeClass = isShort ? 'badge-assigned' : 'badge-exercised';
                        actionsEl.innerHTML = `
                            <span class="badge ${pos.initial_type.toLowerCase()}">${pos.initial_type}${origPriceStr ? ` @ $${origPriceStr}` : ''}</span>
                            <span class="roll-arrow-icon">&rarr;</span>
                            <span class="badge ${badgeClass}">${badgeLabel}</span>
                        `;
                    }
                    closePriceInput.value = '0.00';
                    closePriceInput.readOnly = true;
                    closePriceInput.classList.add('input-readonly');
                    closeCommInput.value = '0.00';
                    closeCommInput.readOnly = true;
                    closeCommInput.classList.add('input-readonly');

                    const strike = pos.strike_price || 0;
                    let basis = strike;
                    let metricLabel = '';
                    let premiumLabel = '';

                    if (isShort && isCall) {
                        basis = strike + origPrice;
                        metricLabel = 'Effective Sale:';
                        premiumLabel = 'Premium Kept:';
                    } else if (isShort && !isCall) {
                        basis = strike - origPrice;
                        metricLabel = 'Effective Basis:';
                        premiumLabel = 'Premium Kept:';
                    } else if (!isShort && isCall) {
                        basis = strike + origPrice;
                        metricLabel = 'Effective Basis:';
                        premiumLabel = 'Premium Paid:';
                    } else {
                        basis = strike - origPrice;
                        metricLabel = 'Effective Net Sale:';
                        premiumLabel = 'Premium Paid:';
                    }

                    document.getElementById('close-effective-basis').value = basis.toFixed(2);
                    const sharesCount = (parseInt(closeQtyInput.value) || 1) * (pos.multiplier || 100);
                    const shareSign = isDelivering ? '-' : '+';
                    const shareText = isDelivering 
                        ? `-${sharesCount}x ${pos.symbol} (Sold / Delivered)` 
                        : `+${sharesCount}x ${pos.symbol} (Acquired / Bought)`;

                    document.getElementById('close-notes').value = `${outcome} ${shareSign}${sharesCount} shares @ $${strike.toFixed(2)}. ${metricLabel} $${basis.toFixed(2)}/sh`;

                    if (memoEl) {
                        memoEl.innerHTML = `
                            <div class="delivery-memo-title">${memoTitle}</div>
                            <div class="delivery-memo-grid">
                                <div class="delivery-memo-item"><span class="delivery-memo-label">Shares:</span> ${shareText}</div>
                                <div class="delivery-memo-item"><span class="delivery-memo-label">Strike:</span> $${formatCurrency(strike)}</div>
                                <div class="delivery-memo-item"><span class="delivery-memo-label">${premiumLabel}</span> $${formatCurrency(origPrice)}/sh</div>
                                <div class="delivery-memo-item"><span class="delivery-memo-label">${metricLabel}</span> <strong>$${formatCurrency(basis)}/sh</strong></div>
                            </div>
                        `;
                        memoEl.style.display = 'block';
                    }
                }
                calculateCloseTotal();
            });
        });
    };
    setupCloseMethodSelector();

    const closePriceInput = document.getElementById('close-option-price');
    const closeCommInput = document.getElementById('close-commission');
    const closeUsdInput = document.getElementById('close-total-usd');
    const closeTypeInput = document.getElementById('close-type');
    const closeQtyInput = document.getElementById('close-qty');
    const closeSummaryTotalEl = document.getElementById('close-summary-total');
    const closeSummaryCostEl = document.getElementById('close-summary-cost');
    const closeSummaryPnlEl = document.getElementById('close-summary-pnl');
    const closeSingleTotalDisplayEl = document.getElementById('close-single-total-display');
    const closeSinglePnlDisplayEl = document.getElementById('close-single-pnl-display');

    const calculateCloseTotal = () => {
        const id = document.getElementById('close-pos-id').value;
        const pos = allPositions.find(p => p.id === parseInt(id));
        const multiplier = pos ? pos.multiplier : 100;
        
        const qty = parseInt(closeQtyInput.value) || 0;
        const price = parseFloat(closePriceInput.value) || 0;
        const comm = parseFloat(closeCommInput.value) || 0;
        const type = closeTypeInput.value;
        let total = qty * price * multiplier;
        let closeTotal = 0;
        if (type === 'BTO' || type === 'BTC') {
            closeTotal = -(total + comm);
        } else if (type === 'EXP' || type === 'ASSIGN' || type === 'EXERCISE') {
            closeTotal = -comm;
        } else {
            closeTotal = total - comm;
        }

        if (Math.abs(closeTotal) < 0.005) closeTotal = 0;
        closeUsdInput.value = closeTotal.toFixed(2);

        const sign = closeTotal > 0 ? '+' : '';
        const closeTotalText = `${sign}${formatCurrency(closeTotal)}`;
        if (closeSummaryTotalEl) {
            closeSummaryTotalEl.textContent = closeTotalText;
            closeSummaryTotalEl.className = `group-roll-stat-val ${closeTotal >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
        }
        if (closeSingleTotalDisplayEl) {
            closeSingleTotalDisplayEl.textContent = closeTotalText;
            closeSingleTotalDisplayEl.className = `roll-total-val ${closeTotal >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
        }

        let openingCost = 0;
        if (pos) {
            openingCost = (pos.total_cost_usd / pos.current_quantity) * qty;
            if (closeSummaryCostEl) {
                closeSummaryCostEl.textContent = formatCurrency(openingCost);
                closeSummaryCostEl.className = 'group-roll-stat-val';
            }

            const pnl = openingCost + closeTotal;
            const normalizedPnl = Math.abs(pnl) < 0.005 ? 0 : pnl;
            const pnlSign = normalizedPnl > 0 ? '+' : '';
            const pnlText = `${pnlSign}${formatCurrency(normalizedPnl)}`;
            if (closeSummaryPnlEl) {
                closeSummaryPnlEl.textContent = pnlText;
                closeSummaryPnlEl.className = `group-roll-stat-val ${normalizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
            }
            if (closeSinglePnlDisplayEl) {
                closeSinglePnlDisplayEl.textContent = pnlText;
                closeSinglePnlDisplayEl.className = `roll-total-val ${normalizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
            }
        }
    };

    [closePriceInput, closeCommInput, closeTypeInput, closeQtyInput].forEach(el => {
        if (el) {
            el.addEventListener('input', calculateCloseTotal);
            el.addEventListener('change', calculateCloseTotal);
        }
    });

    formClose.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('close-pos-id').value;
        const basisVal = document.getElementById('close-effective-basis').value;
        const data = {
            date: document.getElementById('close-date').value + "T00:00:00",
            transaction_type: document.getElementById('close-type').value,
            quantity: parseInt(document.getElementById('close-qty').value),
            option_price: parseFloat(document.getElementById('close-option-price').value) || 0.0,
            commission: parseFloat(document.getElementById('close-commission').value) || 0.0,
            total_usd: parseFloat(document.getElementById('close-total-usd').value) || 0.0,
            outcome: document.getElementById('close-outcome').value || "TRADED",
            effective_stock_basis: basisVal ? parseFloat(basisVal) : null,
            close_notes: document.getElementById('close-notes').value || null
        };

        const response = await fetch(`api/positions/${id}/close`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            modalClose.style.display = 'none';
            formClose.reset();
            loadPositions(currentStatus);
        }
    });

    // Roll Position Modal logic
    window.openRollModal = (id) => {
        const pos = allPositions.find(p => p.id === parseInt(id));
        if (!pos) return;

        const origPrice = getOriginalPrice(pos);
        const origPriceStr = origPrice > 0 ? Number(origPrice).toFixed(2) : '';

        document.getElementById('roll-pos-id').value = pos.id;
        document.getElementById('roll-info-summary').innerHTML = `
            <span class="roll-summary-badge">${pos.symbol}</span>
            Rolling <strong>${pos.contract_name}</strong> (${pos.current_quantity}x)${origPriceStr ? ` &bull; Opened @ <strong>$${origPriceStr}</strong> (${pos.initial_type})` : ''} &bull; Current: Roll #${pos.roll_count || 0}
        `;
        document.getElementById('roll-date').valueAsDate = new Date();

        // Rule 1: Close is always reverse of initial
        const defaultCloseType = (pos.initial_type === 'STO') ? 'BTC' : 'STC';
        // Rule 2: Open is always reverse of close
        const defaultOpenType = (defaultCloseType === 'BTC') ? 'STO' : 'BTO';
        // Rule 3: Call/Put never changes
        const callPut = pos.call_put || 'Put';

        document.getElementById('roll-close-type').value = defaultCloseType;
        document.getElementById('roll-new-type').value = defaultOpenType;
        document.getElementById('roll-new-cp').value = callPut;

        document.getElementById('single-roll-contract-name').textContent = pos.contract_name;
        document.getElementById('single-roll-actions').innerHTML = `
            <span class="badge ${pos.initial_type.toLowerCase()}">${pos.initial_type}${origPriceStr ? ` @ $${origPriceStr}` : ''}</span>
            <span class="roll-arrow-icon">&rarr;</span>
            <span class="badge ${defaultCloseType.toLowerCase()}">${defaultCloseType}</span>
            <span class="roll-arrow-icon">&rarr;</span>
            <span class="badge ${defaultOpenType.toLowerCase()}">${defaultOpenType}</span>
        `;
        document.getElementById('roll-new-cp-badge').textContent = callPut;

        const defaultClosePrice = (pos.ib_current_price !== null && pos.ib_current_price !== undefined) 
            ? Number(pos.ib_current_price).toFixed(2) 
            : '';
        document.getElementById('roll-close-price').value = defaultClosePrice;
        document.getElementById('roll-close-price').placeholder = '0.00';
        document.getElementById('roll-close-commission').value = '0.00';

        const expDate = pos.expiration_date ? pos.expiration_date.split('T')[0] : '';
        document.getElementById('roll-new-exp').value = expDate;
        document.getElementById('roll-new-strike').value = pos.strike_price || '';
        document.getElementById('roll-new-price').value = '';
        document.getElementById('roll-new-commission').value = '0.00';

        calculateRollTotals();
        if (modalRoll) modalRoll.style.display = 'block';
    };

    const rollClosePriceInput = document.getElementById('roll-close-price');
    const rollCloseCommInput = document.getElementById('roll-close-commission');
    const rollCloseTotalEl = document.getElementById('roll-close-total');
    const rollCloseTotalHidden = document.getElementById('roll-close-total-val');
    const rollNewPriceInput = document.getElementById('roll-new-price');
    const rollNewCommInput = document.getElementById('roll-new-commission');
    const rollNewTotalEl = document.getElementById('roll-new-total');
    const rollNewTotalHidden = document.getElementById('roll-new-total-val');
    const rollSummaryCloseEl = document.getElementById('roll-summary-close-total');
    const rollSummaryOpenEl = document.getElementById('roll-summary-open-total');
    const rollNetDiffEl = document.getElementById('roll-net-diff');

    const calculateRollTotals = () => {
        const id = document.getElementById('roll-pos-id').value;
        const pos = allPositions.find(p => p.id === parseInt(id));
        const multiplier = pos ? (pos.multiplier || 100) : 100;
        const qty = pos ? (pos.current_quantity || 1) : 1;

        const closeType = document.getElementById('roll-close-type').value || ((pos && pos.initial_type === 'STO') ? 'BTC' : 'STC');
        const openType = document.getElementById('roll-new-type').value || ((closeType === 'BTC') ? 'STO' : 'BTO');

        const closePrice = parseFloat(rollClosePriceInput.value) || 0;
        const closeComm = parseFloat(rollCloseCommInput.value) || 0;
        const isCloseBuy = closeType === 'BTC';
        let closeTotal = 0;
        let hasClose = false;
        if (rollClosePriceInput.value !== '') {
            const gross = qty * closePrice * multiplier;
            closeTotal = isCloseBuy ? -(gross + closeComm) : (gross - closeComm);
            const sign = closeTotal >= 0 ? '+' : '';
            rollCloseTotalEl.textContent = `${sign}${formatCurrency(closeTotal)}`;
            rollCloseTotalEl.className = `roll-total-val ${closeTotal >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
            rollCloseTotalHidden.value = closeTotal.toFixed(2);
            hasClose = true;
        } else {
            rollCloseTotalEl.textContent = '-';
            rollCloseTotalEl.className = 'roll-total-val';
            rollCloseTotalHidden.value = '';
        }

        const newPrice = parseFloat(rollNewPriceInput.value) || 0;
        const newComm = parseFloat(rollNewCommInput.value) || 0;
        const isOpenBuy = openType === 'BTO';
        let newTotal = 0;
        let hasOpen = false;
        if (rollNewPriceInput.value !== '') {
            const gross = qty * newPrice * multiplier;
            newTotal = isOpenBuy ? -(gross + newComm) : (gross - newComm);
            const sign = newTotal >= 0 ? '+' : '';
            rollNewTotalEl.textContent = `${sign}${formatCurrency(newTotal)}`;
            rollNewTotalEl.className = `roll-total-val ${newTotal >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
            rollNewTotalHidden.value = newTotal.toFixed(2);
            hasOpen = true;
        } else {
            rollNewTotalEl.textContent = '-';
            rollNewTotalEl.className = 'roll-total-val';
            rollNewTotalHidden.value = '';
        }

        if (rollSummaryCloseEl) {
            rollSummaryCloseEl.textContent = hasClose ? `${closeTotal >= 0 ? '+' : ''}${formatCurrency(closeTotal)}` : '0.00';
            rollSummaryCloseEl.className = `group-roll-stat-val ${closeTotal >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
        }
        if (rollSummaryOpenEl) {
            rollSummaryOpenEl.textContent = hasOpen ? `${newTotal >= 0 ? '+' : ''}${formatCurrency(newTotal)}` : '0.00';
            rollSummaryOpenEl.className = `group-roll-stat-val ${newTotal >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
        }

        if (rollNetDiffEl) {
            if (hasClose && hasOpen) {
                const netDiff = closeTotal + newTotal;
                const sign = netDiff >= 0 ? '+' : '';
                const desc = netDiff >= 0 ? 'Net Credit' : 'Net Debit';
                rollNetDiffEl.textContent = `${sign}${formatCurrency(netDiff)} (${desc})`;
                rollNetDiffEl.className = `group-roll-stat-val ${netDiff >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
            } else {
                rollNetDiffEl.textContent = '-';
                rollNetDiffEl.className = 'group-roll-stat-val';
            }
        }
    };

    [rollClosePriceInput, rollCloseCommInput, rollNewPriceInput, rollNewCommInput].forEach(el => {
        if (el) {
            el.addEventListener('input', calculateRollTotals);
            el.addEventListener('change', calculateRollTotals);
        }
    });

    if (formRoll) {
        formRoll.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('roll-pos-id').value;
            const closeDate = document.getElementById('roll-date').value;
            const newExp = document.getElementById('roll-new-exp').value;
            if (!closeDate || !newExp) {
                alert('Please provide both roll date and new expiration date.');
                return;
            }

            const closeTotalVal = rollCloseTotalHidden.value;
            const newTotalVal = rollNewTotalHidden.value;

            const data = {
                date: closeDate + "T00:00:00",
                close_transaction_type: document.getElementById('roll-close-type').value,
                close_price: parseFloat(rollClosePriceInput.value),
                close_commission: parseFloat(rollCloseCommInput.value) || 0,
                close_total_usd: closeTotalVal !== '' ? parseFloat(closeTotalVal) : null,
                new_expiration_date: newExp + "T00:00:00",
                new_strike_price: parseFloat(document.getElementById('roll-new-strike').value),
                new_call_put: document.getElementById('roll-new-cp').value,
                new_transaction_type: document.getElementById('roll-new-type').value,
                new_option_price: parseFloat(rollNewPriceInput.value),
                new_commission: parseFloat(rollNewCommInput.value) || 0,
                new_total_usd: newTotalVal !== '' ? parseFloat(newTotalVal) : null
            };

            try {
                const response = await fetch(`api/positions/${id}/roll`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (response.ok) {
                    if (modalRoll) modalRoll.style.display = 'none';
                    if (modalGroupRoll) modalGroupRoll.style.display = 'none';
                    formRoll.reset();
                    loadPositions(currentStatus);
                } else {
                    const err = await response.json();
                    alert(`Error rolling position: ${err.detail || 'Unknown error'}`);
                }
            } catch (err) {
                console.error('Failed to roll position:', err);
                alert(`Network error rolling position: ${err.message}`);
            }
        });
    }

    function calculateGroupEditMaxLoss() {
        const overrideCheckbox = document.getElementById('edit-group-override-max-loss');
        const maxLossInput = document.getElementById('edit-group-max-loss');
        const isOverridden = overrideCheckbox && overrideCheckbox.checked;
        setMaxLossInputState(maxLossInput, isOverridden);

        const legs = Array.from(groupLegsContainer.querySelectorAll('.group-leg-row'));
        const qty = parseInt(document.getElementById('edit-group-qty').value) || 0;
        const multiplier = parseFloat(document.getElementById('edit-group-multiplier').value) || 100;
        let totalNetUsd = 0;
        legs.forEach(leg => {
            totalNetUsd += parseFloat(leg.querySelector('.leg-usd').value) || 0;
        });

        let maxLoss = 0;
        let breakeven = 0;
        const netPremiumPerShare = Math.abs(totalNetUsd / multiplier / qty);

        if (legs.length === 2) {
            const types = legs.map(l => l.querySelector('.leg-type').value);
            const strikes = legs.map(l => parseFloat(l.querySelector('.leg-strike').value) || 0);
            const cps = legs.map(l => l.querySelector('.leg-cp').value);
            
            if (types.includes('STO') && types.includes('BTO')) {
                const strikeWidth = Math.abs(strikes[0] - strikes[1]);
                if (totalNetUsd > 0) { // Credit Spread
                    maxLoss = (strikeWidth * multiplier * qty) - totalNetUsd;
                    const shortStrike = parseFloat(legs.find(l => l.querySelector('.leg-type').value === 'STO').querySelector('.leg-strike').value);
                    if (cps[0] === 'Put') {
                        breakeven = shortStrike - netPremiumPerShare;
                    } else {
                        breakeven = shortStrike + netPremiumPerShare;
                    }
                } else { // Debit Spread
                    maxLoss = Math.abs(totalNetUsd);
                    const longStrike = parseFloat(legs.find(l => l.querySelector('.leg-type').value === 'BTO').querySelector('.leg-strike').value);
                    if (cps[0] === 'Put') {
                        breakeven = longStrike - netPremiumPerShare;
                    } else {
                        breakeven = longStrike + netPremiumPerShare;
                    }
                }
            }
        } else if (legs.length === 1) {
            const type = legs[0].querySelector('.leg-type').value;
            const cp = legs[0].querySelector('.leg-cp').value;
            const strike = parseFloat(legs[0].querySelector('.leg-strike').value) || 0;
            
            if (type === 'STO' && cp === 'Put') {
                maxLoss = Math.abs(strike * multiplier * qty) - totalNetUsd;
                breakeven = strike - netPremiumPerShare;
            } else if (type === 'BTO' && cp === 'Put') {
                maxLoss = Math.abs(totalNetUsd);
                breakeven = strike - netPremiumPerShare;
            } else if (type === 'STO' && cp === 'Call') {
                maxLoss = 0;
                breakeven = strike + netPremiumPerShare;
            } else if (type === 'BTO' && cp === 'Call') {
                maxLoss = Math.abs(totalNetUsd);
                breakeven = strike + netPremiumPerShare;
            }
        }
        
        if (!isOverridden) {
            maxLossInput.value = formatCurrency(maxLoss);
        }
        const beEl = document.getElementById('edit-group-breakeven');
        if (beEl) {
            beEl.textContent = breakeven > 0 ? formatCurrency(breakeven) : '-';
        }
        const netTotalEl = document.getElementById('edit-group-net-total');
        if (netTotalEl) {
            const desc = totalNetUsd >= 0 ? 'Net Credit' : 'Net Debit';
            netTotalEl.textContent = `${totalNetUsd >= 0 ? '+' : ''}${formatCurrency(totalNetUsd)} (${desc})`;
            netTotalEl.className = `group-roll-stat-val ${totalNetUsd >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
        }
    }

    window.openGroupEditModal = (groupId) => {
        const group = allPositions.filter(p => p.group_id === groupId);
        if (group.length === 0) return;

        document.getElementById('edit-group-id').value = groupId;
        document.getElementById('edit-group-symbol').value = group[0].symbol;
        document.getElementById('edit-group-date').value = group[0].date_opened.split('T')[0];
        document.getElementById('edit-group-exp-date').value = group[0].expiration_date ? group[0].expiration_date.split('T')[0] : '';
        document.getElementById('edit-group-multiplier').value = group[0].multiplier;
        
        const initialQty = group[0].transactions
            .filter(t => t.transaction_type === 'BTO' || t.transaction_type === 'STO')
            .reduce((sum, t) => sum + t.quantity, 0);
        document.getElementById('edit-group-qty').value = initialQty;

        const infoEl = document.getElementById('group-edit-info-summary');
        if (infoEl) {
            const isAllClosed = group.every(p => p.status === 'Closed');
            const reopenGroupBtnHtml = isAllClosed
                ? `<button type="button" class="btn-icon-small" style="margin-left: 12px; background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; cursor: pointer; padding: 2px 8px; border-radius: 4px;" onclick="reopenGroup('${groupId}')">↩️ Reopen Group</button>`
                : '';
            infoEl.innerHTML = `
                <span class="roll-summary-badge">${group[0].symbol}</span>
                Editing <strong>${group.length}-Leg Strategy</strong> (${initialQty}x) &bull; Exp: ${group[0].expiration_date ? group[0].expiration_date.split('T')[0] : '-'}
                ${reopenGroupBtnHtml}
            `;
        }
        
        const groupOverrideCheckbox = document.getElementById('edit-group-override-max-loss');
        const groupMaxLossInput = document.getElementById('edit-group-max-loss');
        const savedGroupMaxLoss = group[0].max_loss !== undefined && group[0].max_loss !== null ? group[0].max_loss : null;
        if (groupOverrideCheckbox) groupOverrideCheckbox.checked = false;
        setMaxLossInputState(groupMaxLossInput, false);
        groupMaxLossInput.value = (savedGroupMaxLoss !== null && savedGroupMaxLoss !== 999999) ? formatCurrency(savedGroupMaxLoss) : '0.00';

        // Show/hide Date Closed field
        const closedDateContainer = document.getElementById('edit-group-closed-date-container');
        const closedDateInput = document.getElementById('edit-group-closed-date');
        const isClosed = group.every(p => p.status === 'Closed');
        
        if (isClosed) {
            closedDateContainer.style.display = 'block';
            let latestDate = group[0].date_opened;
            group.forEach(p => {
                p.transactions.forEach(t => {
                    if (t.date > latestDate) latestDate = t.date;
                });
            });
            closedDateInput.value = latestDate.split('T')[0];
        } else {
            closedDateContainer.style.display = 'none';
        }

        groupLegsContainer.innerHTML = '';
        const closingTbody = document.getElementById('edit-group-closing-tbody');
        const closingSection = document.getElementById('edit-group-closing-section');
        if (closingTbody) closingTbody.innerHTML = '';
        let hasAnyClosedLeg = false;

        group.forEach(pos => {
            const tr = document.createElement('tr');
            tr.className = 'leg-entry group-leg-row roll-leg-row';
            tr.dataset.posId = pos.id;
            
            const openTrans = pos.transactions.find(t => t.transaction_type === 'BTO' || t.transaction_type === 'STO');
            tr.dataset.transId = openTrans ? openTrans.id : '';

            const isClosed = pos.status === 'Closed';
            const closeTrans = isClosed ? pos.transactions.find(t => t.transaction_type === 'BTC' || t.transaction_type === 'STC') : null;
            if (closeTrans) tr.dataset.closeTransId = closeTrans.id;

            tr.innerHTML = `
                <td>
                    <input type="text" class="roll-input leg-contract" value="${pos.contract_name}" required>
                </td>
                <td>
                    <input type="number" class="roll-input leg-strike" step="any" value="${pos.strike_price}" required>
                </td>
                <td>
                    <select class="roll-input leg-cp">
                        <option value="Call" ${pos.call_put === 'Call' ? 'selected' : ''}>Call</option>
                        <option value="Put" ${pos.call_put === 'Put' ? 'selected' : ''}>Put</option>
                    </select>
                </td>
                <td>
                    <select class="roll-input leg-type">
                        <option value="BTO" ${openTrans && openTrans.transaction_type === 'BTO' ? 'selected' : ''}>BTO</option>
                        <option value="STO" ${openTrans && openTrans.transaction_type === 'STO' ? 'selected' : ''}>STO</option>
                    </select>
                </td>
                <td>
                    <input type="number" class="roll-input leg-price" step="any" value="${openTrans ? openTrans.option_price : ''}" required>
                </td>
                <td>
                    <input type="number" class="roll-input leg-comm" step="any" value="${openTrans ? openTrans.commission : '0.00'}">
                </td>
                <td>
                    <input type="number" class="roll-input leg-usd" step="any" value="${openTrans ? openTrans.total_usd : ''}" readonly style="font-weight: bold; opacity: 0.85;">
                </td>
            `;
            groupLegsContainer.appendChild(tr);

            if (closeTrans && closingTbody) {
                hasAnyClosedLeg = true;
                const closeTr = document.createElement('tr');
                closeTr.className = 'roll-leg-row';
                closeTr.dataset.posId = pos.id;
                closeTr.innerHTML = `
                    <td><strong>${pos.contract_name}</strong></td>
                    <td>
                        <select class="roll-input close-leg-type">
                            <option value="BTC" ${closeTrans.transaction_type === 'BTC' ? 'selected' : ''}>BTC</option>
                            <option value="STC" ${closeTrans.transaction_type === 'STC' ? 'selected' : ''}>STC</option>
                        </select>
                    </td>
                    <td>
                        <input type="number" class="roll-input close-leg-price" step="any" value="${closeTrans.option_price}" required>
                    </td>
                    <td>
                        <input type="number" class="roll-input close-leg-comm" step="any" value="${closeTrans.commission}">
                    </td>
                    <td>
                        <input type="number" class="roll-input close-leg-usd" step="any" value="${closeTrans.total_usd}" readonly style="font-weight: bold; opacity: 0.85;">
                    </td>
                `;
                closingTbody.appendChild(closeTr);

                closeTr.querySelectorAll('input, select').forEach(el => {
                    el.addEventListener('input', () => {
                        const qty = parseInt(document.getElementById('edit-group-qty').value) || 0;
                        const multiplier = parseFloat(document.getElementById('edit-group-multiplier').value) || 100;
                        const cPrice = parseFloat(closeTr.querySelector('.close-leg-price').value) || 0;
                        const cComm = parseFloat(closeTr.querySelector('.close-leg-comm').value) || 0;
                        const cType = closeTr.querySelector('.close-leg-type').value;
                        let cTotal = qty * cPrice * multiplier;
                        closeTr.querySelector('.close-leg-usd').value = (cType === 'BTO' || cType === 'BTC' ? -(cTotal + cComm) : (cTotal - cComm)).toFixed(2);
                    });
                });
            }

            tr.querySelectorAll('input, select').forEach(el => {
                el.addEventListener('input', () => {
                    const strike = tr.querySelector('.leg-strike').value;
                    const cp = tr.querySelector('.leg-cp').value;
                    const expDate = document.getElementById('edit-group-exp-date').value;
                    const groupSymbol = (document.getElementById('edit-group-symbol')?.value || '').trim();
                    const autoName = formatContractName(expDate, strike, cp, groupSymbol);
                    if (autoName) tr.querySelector('.leg-contract').value = autoName;

                    const qty = parseInt(document.getElementById('edit-group-qty').value) || 0;
                    const multiplier = parseFloat(document.getElementById('edit-group-multiplier').value) || 100;
                    
                    // Update Opening Total
                    const price = parseFloat(tr.querySelector('.leg-price').value) || 0;
                    const comm = parseFloat(tr.querySelector('.leg-comm').value) || 0;
                    const type = tr.querySelector('.leg-type').value;
                    let total = qty * price * multiplier;
                    if (type === 'BTO' || type === 'BTC') {
                        tr.querySelector('.leg-usd').value = (-(total + comm)).toFixed(2);
                    } else {
                        tr.querySelector('.leg-usd').value = (total - comm).toFixed(2);
                    }

                    calculateGroupEditMaxLoss();
                });
            });
        });

        if (closingSection) {
            closingSection.style.display = hasAnyClosedLeg ? 'block' : 'none';
        }

        calculateGroupEditMaxLoss();
        if (savedGroupMaxLoss !== null && savedGroupMaxLoss !== 999999) {
            groupMaxLossInput.value = formatCurrency(savedGroupMaxLoss);
        }
        modalGroupEdit.style.display = 'block';
    };

    const groupOverrideCheckboxEl = document.getElementById('edit-group-override-max-loss');
    if (groupOverrideCheckboxEl) {
        groupOverrideCheckboxEl.addEventListener('change', () => {
            calculateGroupEditMaxLoss();
            if (groupOverrideCheckboxEl.checked) {
                document.getElementById('edit-group-max-loss').focus();
            }
        });
    }

    ['edit-group-qty', 'edit-group-exp-date', 'edit-group-multiplier'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            if (id === 'edit-group-exp-date') {
                const groupSymbol = (document.getElementById('edit-group-symbol')?.value || '').trim();
                groupLegsContainer.querySelectorAll('.group-leg-row').forEach(row => {
                    const strike = row.querySelector('.leg-strike').value;
                    const cp = row.querySelector('.leg-cp').value;
                    const autoName = formatContractName(document.getElementById(id).value, strike, cp, groupSymbol);
                    if (autoName) row.querySelector('.leg-contract').value = autoName;
                });
            }
            groupLegsContainer.querySelectorAll('.group-leg-row').forEach(row => {
                row.querySelector('.leg-price').dispatchEvent(new Event('input'));
            });
            calculateGroupEditMaxLoss();
        });
    });

    const calculateGroupCloseTotal = () => {
        const legRows = groupCloseLegsContainer.querySelectorAll('.group-close-leg-row');
        const qtyToClose = parseInt(document.getElementById('close-group-qty').value) || 0;
        let grandClosingTotal = 0;
        let grandOpeningCost = 0;

        const groupId = document.getElementById('close-group-id').value;
        const group = allPositions.filter(p => p.group_id === groupId);
        const multiplier = group.length > 0 ? group[0].multiplier : 100;
        
        legRows.forEach(row => {
            const price = parseFloat(row.querySelector('.close-leg-price').value) || 0;
            const comm = parseFloat(row.querySelector('.close-leg-comm').value) || 0;
            const type = row.dataset.closeType;
            const posMultiplier = parseFloat(row.dataset.multiplier) || 100;
            
            let total = qtyToClose * price * posMultiplier;
            let legClosingTotal = 0;
            if (type === 'BTO' || type === 'BTC') {
                legClosingTotal = -(total + comm);
            } else {
                legClosingTotal = total - comm;
            }
            
            const sign = legClosingTotal >= 0 ? '+' : '';
            const totalDisplayEl = row.querySelector('.close-leg-total-display');
            const totalHiddenEl = row.querySelector('.close-leg-total');
            const pnlDisplayEl = row.querySelector('.close-leg-pnl-display');

            totalDisplayEl.textContent = `${sign}${formatCurrency(legClosingTotal)}`;
            totalDisplayEl.className = `roll-total-val ${legClosingTotal >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
            totalHiddenEl.value = legClosingTotal.toFixed(2);
            grandClosingTotal += legClosingTotal;

            const posId = parseInt(row.dataset.posId);
            const pos = allPositions.find(p => p.id === posId);
            if (pos) {
                const proRatedOpeningCost = (pos.total_cost_usd / pos.current_quantity) * qtyToClose;
                grandOpeningCost += proRatedOpeningCost;

                const legPnl = proRatedOpeningCost + legClosingTotal;
                const pnlSign = legPnl >= 0 ? '+' : '';
                pnlDisplayEl.textContent = `${pnlSign}${formatCurrency(legPnl)}`;
                pnlDisplayEl.className = `roll-total-val ${legPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
            }
        });
        
        const netTotalEl = document.getElementById('group-close-net-total');
        netTotalEl.textContent = `${grandClosingTotal >= 0 ? '+' : ''}${formatCurrency(grandClosingTotal)}`;
        netTotalEl.className = `group-roll-stat-val ${grandClosingTotal >= 0 ? 'pnl-positive' : 'pnl-negative'}`;

        const openCostEl = document.getElementById('group-close-open-cost');
        openCostEl.textContent = formatCurrency(grandOpeningCost);
        openCostEl.className = `group-roll-stat-val`;

        const pnl = grandOpeningCost + grandClosingTotal;
        const pnlEl = document.getElementById('group-close-pnl');
        pnlEl.textContent = `${pnl >= 0 ? '+' : ''}${formatCurrency(pnl)}`;
        pnlEl.className = `group-roll-stat-val ${pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
    };

    window.openGroupCloseModal = (groupId) => {
        const group = allPositions.filter(p => p.group_id === groupId);
        if (group.length === 0) return;

        const firstPos = group[0];
        document.getElementById('close-group-id').value = groupId;
        document.getElementById('group-close-info-summary').innerHTML = `
            <span class="roll-summary-badge">${firstPos.symbol}</span>
            Closing <strong>${group.length}-Leg Strategy</strong> (${firstPos.current_quantity}x)
        `;
        document.getElementById('close-group-date').valueAsDate = new Date();
        document.getElementById('close-group-qty').value = firstPos.current_quantity;

        groupCloseLegsContainer.innerHTML = '';
        group.forEach(pos => {
            const tr = document.createElement('tr');
            tr.className = 'group-close-leg-row roll-leg-row';
            tr.dataset.posId = pos.id;
            tr.dataset.multiplier = pos.multiplier || 100;
            
            const closeType = (pos.initial_type === 'BTO' || pos.initial_type === 'BTC') ? 'STC' : 'BTC';
            tr.dataset.closeType = closeType;

            const defaultClosePrice = (pos.ib_current_price !== null && pos.ib_current_price !== undefined) 
                ? Number(pos.ib_current_price).toFixed(2) 
                : '';

            const origPrice = getOriginalPrice(pos);
            const origPriceStr = origPrice > 0 ? Number(origPrice).toFixed(2) : '';

            tr.innerHTML = `
                <td class="col-leg">
                    <div class="roll-leg-contract">${pos.contract_name}</div>
                    <div class="roll-leg-actions">
                        <span class="badge ${pos.initial_type.toLowerCase()}">${pos.initial_type}${origPriceStr ? ` @ $${origPriceStr}` : ''}</span>
                        <span class="roll-arrow-icon">&rarr;</span>
                        <span class="badge ${closeType.toLowerCase()}">${closeType}</span>
                    </div>
                    <input type="hidden" class="close-leg-type" value="${closeType}">
                </td>
                <td class="col-close-price">
                    <input type="number" class="roll-input close-leg-price" step="any" required value="${defaultClosePrice}" placeholder="0.00">
                </td>
                <td class="col-close-comm">
                    <input type="number" class="roll-input close-leg-comm" step="any" value="0.00">
                </td>
                <td class="col-close-total">
                    <span class="roll-total-val close-leg-total-display">-</span>
                    <input type="hidden" class="close-leg-total">
                </td>
                <td class="col-close-pnl">
                    <span class="roll-total-val close-leg-pnl-display">-</span>
                </td>
            `;
            groupCloseLegsContainer.appendChild(tr);

            tr.querySelectorAll('input').forEach(el => {
                el.addEventListener('input', calculateGroupCloseTotal);
                el.addEventListener('change', calculateGroupCloseTotal);
            });
        });

        calculateGroupCloseTotal();
        modalGroupClose.style.display = 'block';
    };
    document.getElementById('close-group-qty').addEventListener('input', calculateGroupCloseTotal);

    formGroupClose.addEventListener('submit', async (e) => {
        e.preventDefault();
        const closeDate = document.getElementById('close-group-date').value + "T00:00:00";
        const quantity = parseInt(document.getElementById('close-group-qty').value);
        
        const legRows = document.querySelectorAll('.group-close-leg-row');
        const requests = Array.from(legRows).map(row => {
            const posId = row.dataset.posId;
            const data = {
                date: closeDate,
                transaction_type: row.querySelector('.close-leg-type').value,
                quantity: quantity,
                option_price: parseFloat(row.querySelector('.close-leg-price').value),
                commission: parseFloat(row.querySelector('.close-leg-comm').value),
                total_usd: parseFloat(row.querySelector('.close-leg-total').value.replace(/,/g, ''))
            };
            return fetch(`api/positions/${posId}/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        });

        try {
            const results = await Promise.all(requests);
            if (results.every(r => r.ok)) {
                modalGroupClose.style.display = 'none';
                loadPositions('Open');
            } else {
                alert("Failed to close some legs. Please check manually.");
            }
        } catch (error) {
            console.error("Batch close failed:", error);
            alert("An error occurred during batch close.");
        }
    });

    const calculateGroupRollTotals = () => {
        if (!groupRollLegsTbody) return;
        const legRows = groupRollLegsTbody.querySelectorAll('.group-roll-leg-row');
        const qty = parseInt(document.getElementById('group-roll-qty').value) || 1;
        
        let totalCloseUSD = 0;
        let totalOpenUSD = 0;

        legRows.forEach(row => {
            const multiplier = parseFloat(row.dataset.multiplier) || 100;
            const closeType = row.dataset.closeType;
            const openType = row.dataset.openType;
            
            // Close calculation
            const closePriceInput = row.querySelector('.group-roll-close-price');
            const closeCommInput = row.querySelector('.group-roll-close-comm');
            const closeTotalEl = row.querySelector('.group-roll-close-total');
            const closePrice = parseFloat(closePriceInput.value) || 0;
            const closeComm = parseFloat(closeCommInput.value) || 0;
            const isCloseBuy = closeType === 'BTC';

            let closeTotal = 0;
            if (closePriceInput.value !== '') {
                const gross = qty * closePrice * multiplier;
                closeTotal = isCloseBuy ? -(gross + closeComm) : (gross - closeComm);
                const sign = closeTotal >= 0 ? '+' : '';
                closeTotalEl.textContent = `${sign}${formatCurrency(closeTotal)}`;
                closeTotalEl.className = `group-roll-close-total roll-total-val ${closeTotal >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
                row.dataset.closeTotalVal = closeTotal;
                totalCloseUSD += closeTotal;
            } else {
                closeTotalEl.textContent = '-';
                closeTotalEl.className = 'group-roll-close-total roll-total-val';
                row.dataset.closeTotalVal = '';
            }

            // Open calculation
            const newPriceInput = row.querySelector('.group-roll-new-price');
            const newCommInput = row.querySelector('.group-roll-new-comm');
            const newTotalEl = row.querySelector('.group-roll-new-total');
            const newPrice = parseFloat(newPriceInput.value) || 0;
            const newComm = parseFloat(newCommInput.value) || 0;
            const isOpenBuy = openType === 'BTO';

            let newTotal = 0;
            if (newPriceInput.value !== '') {
                const gross = qty * newPrice * multiplier;
                newTotal = isOpenBuy ? -(gross + newComm) : (gross - newComm);
                const sign = newTotal >= 0 ? '+' : '';
                newTotalEl.textContent = `${sign}${formatCurrency(newTotal)}`;
                newTotalEl.className = `group-roll-new-total roll-total-val ${newTotal >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
                row.dataset.newTotalVal = newTotal;
                totalOpenUSD += newTotal;
            } else {
                newTotalEl.textContent = '-';
                newTotalEl.className = 'group-roll-new-total roll-total-val';
                row.dataset.newTotalVal = '';
            }
        });

        const closeEl = document.getElementById('group-roll-close-total');
        const openEl = document.getElementById('group-roll-open-total');
        const diffEl = document.getElementById('group-roll-net-diff');

        if (closeEl) {
            closeEl.textContent = `${totalCloseUSD >= 0 ? '+' : ''}${formatCurrency(totalCloseUSD)}`;
            closeEl.className = `group-roll-stat-val ${totalCloseUSD >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
        }

        if (openEl) {
            openEl.textContent = `${totalOpenUSD >= 0 ? '+' : ''}${formatCurrency(totalOpenUSD)}`;
            openEl.className = `group-roll-stat-val ${totalOpenUSD >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
        }

        if (diffEl) {
            const netImpact = totalCloseUSD + totalOpenUSD;
            const desc = netImpact >= 0 ? 'Net Credit' : 'Net Debit';
            diffEl.textContent = `${netImpact >= 0 ? '+' : ''}${formatCurrency(netImpact)} (${desc})`;
            diffEl.className = `group-roll-stat-val ${netImpact >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
        }
    };

    window.openGroupRollModal = (groupId) => {
        const group = allPositions.filter(p => p.group_id === groupId);
        if (group.length === 0) return;

        const firstPos = group[0];
        document.getElementById('group-roll-id').value = groupId;
        document.getElementById('group-roll-info-summary').innerHTML = `
            <span class="roll-summary-badge">${firstPos.symbol}</span>
            Rolling <strong>${group.length}-Leg Strategy</strong> (${firstPos.current_quantity}x) &bull; Current Roll Count: #${firstPos.roll_count || 0}
        `;
        document.getElementById('group-roll-date').valueAsDate = new Date();
        document.getElementById('group-roll-qty').value = firstPos.current_quantity;
        document.getElementById('group-roll-exp-date').value = firstPos.expiration_date ? firstPos.expiration_date.split('T')[0] : '';
        document.getElementById('group-roll-max-loss').value = firstPos.max_loss || '';

        groupRollLegsTbody.innerHTML = '';
        group.forEach(pos => {
            const tr = document.createElement('tr');
            tr.className = 'group-roll-leg-row roll-leg-row';
            tr.dataset.posId = pos.id;
            tr.dataset.multiplier = pos.multiplier || 100;

            // Rule 1: Close is always reverse of initial
            const defaultCloseType = (pos.initial_type === 'STO') ? 'BTC' : 'STC';
            // Rule 2: Open is always reverse of close
            const defaultOpenType = (defaultCloseType === 'BTC') ? 'STO' : 'BTO';
            // Rule 3: Call/Put never changes
            const callPut = pos.call_put || 'Put';

            tr.dataset.closeType = defaultCloseType;
            tr.dataset.openType = defaultOpenType;
            tr.dataset.callPut = callPut;

            const defaultClosePrice = (pos.ib_current_price !== null && pos.ib_current_price !== undefined) 
                ? Number(pos.ib_current_price).toFixed(2) 
                : '';

            const origPrice = getOriginalPrice(pos);
            const origPriceStr = origPrice > 0 ? Number(origPrice).toFixed(2) : '';

            tr.innerHTML = `
                <td class="col-leg">
                    <div class="roll-leg-contract">${pos.contract_name}</div>
                    <div class="roll-leg-actions">
                        <span class="badge ${pos.initial_type.toLowerCase()}">${pos.initial_type}${origPriceStr ? ` @ $${origPriceStr}` : ''}</span>
                        <span class="roll-arrow-icon">&rarr;</span>
                        <span class="badge ${defaultCloseType.toLowerCase()}">${defaultCloseType}</span>
                        <span class="roll-arrow-icon">&rarr;</span>
                        <span class="badge ${defaultOpenType.toLowerCase()}">${defaultOpenType}</span>
                    </div>
                </td>
                <td class="col-close-price">
                    <input type="number" class="group-roll-close-price roll-input" step="any" value="${defaultClosePrice}" placeholder="0.00" required>
                </td>
                <td class="col-close-comm">
                    <input type="number" class="group-roll-close-comm roll-input" step="any" value="0.00">
                </td>
                <td class="col-close-total">
                    <span class="group-roll-close-total roll-total-val">-</span>
                </td>
                <td class="col-arrow">
                    <span class="roll-arrow-icon">&rarr;</span>
                </td>
                <td class="col-new-strike">
                    <div class="roll-strike-wrapper">
                        <input type="number" class="group-roll-new-strike roll-input" step="any" value="${pos.strike_price || ''}" required>
                        <span class="roll-cp-badge">${callPut}</span>
                    </div>
                </td>
                <td class="col-new-price">
                    <input type="number" class="group-roll-new-price roll-input" step="any" placeholder="0.00" required>
                </td>
                <td class="col-new-comm">
                    <input type="number" class="group-roll-new-comm roll-input" step="any" value="0.00">
                </td>
                <td class="col-new-total">
                    <span class="group-roll-new-total roll-total-val">-</span>
                </td>
            `;

            groupRollLegsTbody.appendChild(tr);
            tr.querySelectorAll('input').forEach(el => {
                el.addEventListener('input', calculateGroupRollTotals);
                el.addEventListener('change', calculateGroupRollTotals);
            });
        });

        calculateGroupRollTotals();
        if (modalGroupRoll) modalGroupRoll.style.display = 'block';
    };

    if (formGroupRoll) {
        formGroupRoll.addEventListener('submit', async (e) => {
            e.preventDefault();
            const groupId = document.getElementById('group-roll-id').value;
            const rollDate = document.getElementById('group-roll-date').value;
            const newExp = document.getElementById('group-roll-exp-date').value;
            const maxLossVal = document.getElementById('group-roll-max-loss').value;

            if (!rollDate || !newExp) {
                alert('Please provide both roll date and new expiration date.');
                return;
            }

            const legRows = groupRollLegsTbody.querySelectorAll('.group-roll-leg-row');
            const legsData = [];
            for (const row of legRows) {
                const posId = parseInt(row.dataset.posId);
                const closeType = row.dataset.closeType;
                const closePrice = parseFloat(row.querySelector('.group-roll-close-price').value);
                const closeComm = parseFloat(row.querySelector('.group-roll-close-comm').value) || 0;
                const closeTotal = row.dataset.closeTotalVal;

                const newStrike = parseFloat(row.querySelector('.group-roll-new-strike').value);
                const newCp = row.dataset.callPut;
                const newType = row.dataset.openType;
                const newPrice = parseFloat(row.querySelector('.group-roll-new-price').value);
                const newComm = parseFloat(row.querySelector('.group-roll-new-comm').value) || 0;
                const newTotal = row.dataset.newTotalVal;

                legsData.push({
                    position_id: posId,
                    close_transaction_type: closeType,
                    close_price: closePrice,
                    close_commission: closeComm,
                    close_total_usd: closeTotal !== '' ? parseFloat(closeTotal) : null,
                    new_strike_price: newStrike,
                    new_call_put: newCp,
                    new_transaction_type: newType,
                    new_option_price: newPrice,
                    new_commission: newComm,
                    new_total_usd: newTotal !== '' ? parseFloat(newTotal) : null
                });
            }

            const payload = {
                date: rollDate + "T00:00:00",
                new_expiration_date: newExp + "T00:00:00",
                max_loss: maxLossVal ? parseFloat(maxLossVal) : null,
                legs: legsData
            };

            try {
                const response = await fetch(`api/positions/group/${groupId}/roll`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (response.ok) {
                    if (modalGroupRoll) modalGroupRoll.style.display = 'none';
                    formGroupRoll.reset();
                    loadPositions('Open');
                } else {
                    const err = await response.json();
                    alert(`Error rolling spread: ${err.detail || 'Unknown error'}`);
                }
            } catch (err) {
                console.error('Failed to roll spread:', err);
                alert(`Network error rolling spread: ${err.message}`);
            }
        });
    }

    formGroupEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dateOpened = document.getElementById('edit-group-date').value + "T00:00:00";
        const expirationDate = document.getElementById('edit-group-exp-date').value + "T00:00:00";
        const quantity = parseInt(document.getElementById('edit-group-qty').value);
        const multiplier = parseFloat(document.getElementById('edit-group-multiplier').value) || 100;
        const maxLossStr = document.getElementById('edit-group-max-loss').value.replace(/,/g, '');
        const maxLoss = parseFloat(maxLossStr) || 0;
        
        const closedDateInput = document.getElementById('edit-group-closed-date');
        const closedDate = (closedDateInput && closedDateInput.value) ? closedDateInput.value + "T00:00:00" : null;

        const legRows = document.querySelectorAll('#edit-group-legs-container .group-leg-row');
        for (const row of legRows) {
            const posId = row.dataset.posId;
            const transId = row.dataset.transId; // This is the opening transaction id

            // 1. Update the opening transaction
            const transData = {
                date: dateOpened,
                transaction_type: row.querySelector('.leg-type').value,
                quantity: quantity,
                option_price: parseFloat(row.querySelector('.leg-price').value),
                commission: parseFloat(row.querySelector('.leg-comm').value),
                total_usd: parseFloat(row.querySelector('.leg-usd').value)
            };
            await fetch(`api/transactions/${transId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transData)
            });

            // 2. Update closing transaction if it exists
            const closeTransId = row.dataset.closeTransId;
            if (closeTransId) {
                const closeRow = document.querySelector(`#edit-group-closing-tbody tr[data-pos-id="${posId}"]`) || row;
                const closeTransData = {
                    date: closedDate || dateOpened, // Default to open date if no close date set
                    transaction_type: closeRow.querySelector('.close-leg-type').value,
                    quantity: quantity,
                    option_price: parseFloat(closeRow.querySelector('.close-leg-price').value),
                    commission: parseFloat(closeRow.querySelector('.close-leg-comm').value),
                    total_usd: parseFloat(closeRow.querySelector('.close-leg-usd').value)
                };
                await fetch(`api/transactions/${closeTransId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(closeTransData)
                });
            }

            // 3. Update position metadata
            const posData = {
                date_opened: dateOpened,
                expiration_date: expirationDate,
                contract_name: row.querySelector('.leg-contract').value,
                strike_price: parseFloat(row.querySelector('.leg-strike').value),
                call_put: row.querySelector('.leg-cp').value,
                initial_type: row.querySelector('.leg-type').value,
                multiplier: multiplier,
                max_loss: maxLoss
            };
            await fetch(`api/positions/${posId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(posData)
            });
        }

        modalGroupEdit.style.display = 'none';
        loadPositions(currentStatus);
    });

    window.deletePosition = async (id) => {
        if (!confirm('Are you sure you want to delete this position and its history?')) return;
        const response = await fetch(`api/positions/${id}`, { method: 'DELETE' });
        if (response.ok) loadPositions(currentStatus);
    };

    window.deleteGroup = async (groupId) => {
        if (!confirm('Are you sure you want to delete this ENTIRE group and all legs?')) return;
        const response = await fetch(`api/positions/group/${groupId}`, { method: 'DELETE' });
        if (response.ok) loadPositions(currentStatus);
    };

    window.reopenPosition = async (id) => {
        if (!confirm('Reopen this position? This will delete its closing transactions and move it back to Active Open Options.')) return;
        const response = await fetch(`api/positions/${id}/reopen`, { method: 'POST' });
        if (response.ok) {
            if (modalEdit) modalEdit.style.display = 'none';
            loadPositions(currentStatus);
        } else {
            alert('Failed to reopen position');
        }
    };

    window.reopenGroup = async (groupId) => {
        if (!confirm('Reopen this entire group? This will delete closing transactions for all legs and move it back to Active Open Options.')) return;
        const response = await fetch(`api/groups/${groupId}/reopen`, { method: 'POST' });
        if (response.ok) {
            if (modalGroupEdit) modalGroupEdit.style.display = 'none';
            loadPositions(currentStatus);
        } else {
            alert('Failed to reopen group');
        }
    };

    window.deleteClosingTransaction = async (transId, posId) => {
        if (!confirm('Delete this closing transaction and reopen the position?')) return;
        const res = await fetch(`api/transactions/${transId}`, { method: 'DELETE' });
        if (res.ok) {
            if (modalEdit) modalEdit.style.display = 'none';
            loadPositions(currentStatus);
        } else {
            alert('Failed to delete closing transaction');
        }
    };

    window.toggleDetails = (btn, posId) => {
        const row = document.querySelector(`.pos-details-${posId}`);
        if (row) {
            const isHidden = row.style.display === 'none';
            row.style.display = isHidden ? '' : 'none';
            if (btn) {
                btn.classList.toggle('active-drawer', isHidden);
            }
        }
    };

    window.toggleActionMenu = (event, btn) => {
        event.stopPropagation();
        const dropdown = btn.closest('.action-menu-dropdown');
        const popover = dropdown ? dropdown.querySelector('.action-menu-popover') : null;
        const isShowing = popover && popover.style.display !== 'none';
        
        // Close all other popovers
        document.querySelectorAll('.action-menu-popover').forEach(p => {
            p.style.display = 'none';
        });
        
        if (popover && !isShowing) {
            popover.style.display = 'block';
        }
    };

    // Close any open popover when clicking anywhere outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-menu-dropdown')) {
            document.querySelectorAll('.action-menu-popover').forEach(p => {
                p.style.display = 'none';
            });
        }
    });

    async function fetchCurrentPrices() {
        const symbols = new Set();
        document.querySelectorAll('.price-val').forEach(el => {
            symbols.add(el.dataset.symbol);
        });

        if (symbols.size === 0) return;

        try {
            const response = await fetch(`api/prices?symbols=${Array.from(symbols).join(',')}`);
            if (!response.ok) return;
            const prices = await response.json();

            // Update all price-val elements in the document
            document.querySelectorAll('.price-val').forEach(priceEl => {
                const symbol = priceEl.dataset.symbol;
                const currentPrice = prices[symbol];
                if (currentPrice !== undefined) {
                    priceEl.textContent = formatCurrency(currentPrice);
                } else {
                    priceEl.textContent = 'Unavailable';
                }
            });

            // Update all risk-status elements in the document
            document.querySelectorAll('.risk-status').forEach(riskEl => {
                const symbol = riskEl.dataset.symbol;
                const currentPrice = prices[symbol];
                const strike = parseFloat(riskEl.dataset.strike);
                const cp = riskEl.dataset.cp;

                if (currentPrice !== undefined) {
                    let distance = 0;
                    let isITM = false;

                    if (cp === 'Call') {
                        isITM = currentPrice > strike;
                        distance = ((currentPrice - strike) / strike) * 100;
                    } else {
                        isITM = currentPrice < strike;
                        distance = ((strike - currentPrice) / strike) * 100;
                    }

                    const statusText = isITM ? 'ITM 🔴' : 'OTM 🟢';
                    riskEl.innerHTML = `${statusText} <span style="font-size: 0.8rem; font-weight: normal; color: #94a3b8;">(${Math.abs(distance).toFixed(2)}% from strike)</span>`;
                } else {
                    riskEl.textContent = '-';
                }
            });
        } catch (error) {
            console.error('Error fetching prices:', error);
        }
    }

    loadPositions('Open');
});
