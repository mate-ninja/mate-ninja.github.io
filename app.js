const spellTable = document.getElementById('spellTable');
const spellTooltip = document.getElementById('spellTooltip');
const spellSearch = document.getElementById('spellSearch');
const showFavoritesBtn = document.getElementById('showFavorites');
const loadingSpinner = document.getElementById('loadingSpinner');
const levelSelect = document.getElementById('levelSelect');
const specialitySelect = document.getElementById('specialitySelect');
const classSelect = document.getElementById('classSelect');
let currentClass = localStorage.getItem('selectedClass') || 'artificer';
let currentLevel = localStorage.getItem('selectedLevel') || 'all';
const showNonCantripsBtn = document.getElementById('showNonCantrips');
let showNonCantripsOnly = false;

const addCustomSpellBtn = document.getElementById('addCustomSpellBtn');
const customSpellModal = new bootstrap.Modal(document.getElementById('customSpellModal'));
const saveCustomSpellBtn = document.getElementById('saveCustomSpellBtn');
addCustomSpellBtn.style.marginTop = 10px;
addCustomSpellBtn.style.marginBottom = 10px;
const customSpellLevel = document.getElementById('customSpellLevel');
const customSpellName = document.getElementById('customSpellName');

const loadingProgressBar = document.createElement('div');
loadingProgressBar.className = 'loading-progress-bar';
loadingProgressBar.innerHTML = `
    <div class="progress-container">
        <div class="progress-bar"></div>
        <div class="progress-text">0%</div>
        <div class="current-spell"></div>
    </div>
`;

let spells = [];
let favorites = JSON.parse(localStorage.getItem('favoriteSpells')) || [];
let showFavoritesOnly = false;
let currentLoadingPhase = 'initial';
let loadedSpells = 0;
let totalSpells = 0;
let specialitySpells = {};

function init() {
    classSelect.value = currentClass;
    levelSelect.value = currentLevel;
    specialitySelect.value = localStorage.getItem('selectedSpeciality') || 'none';
    updateLevelSelect();
    fetchSpells();
}

init()

showNonCantripsBtn.addEventListener('click', () => {
    showNonCantripsOnly = !showNonCantripsOnly;
    showNonCantripsBtn.classList.toggle('btn-info', showNonCantripsOnly);
    showNonCantripsBtn.classList.toggle('btn-outline-info', !showNonCantripsOnly);
    renderSpellTable();
});

document.getElementById('showSpecialities').setAttribute('title', 'Show speciality spells only');
document.getElementById('showFavorites').setAttribute('title', 'Show favorites only');

const backToTopBtn = document.createElement('div');
backToTopBtn.className = 'back-to-top';
backToTopBtn.innerHTML = '<i class="bi bi-arrow-up"></i>';
backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});
document.body.appendChild(backToTopBtn);

window.addEventListener('scroll', () => {
    backToTopBtn.classList.toggle('visible', window.scrollY > 300);
});


let customSpells = JSON.parse(localStorage.getItem('customSpells')) || {};

// Obsługa przycisku dodawania spellów
addCustomSpellBtn.addEventListener('click', () => {
    customSpellModal.show();
});

const showCustomOnlyBtn = document.getElementById('showCustomOnlyBtn');
let showCustomOnly = false;

showCustomOnlyBtn.addEventListener('click', () => {
    showCustomOnly = !showCustomOnly;
    showCustomOnlyBtn.classList.toggle('btn-info', showCustomOnly);
    showCustomOnlyBtn.classList.toggle('btn-outline-info', !showCustomOnly);
    renderSpellTable();
});

// Zapisywanie nowego spella
saveCustomSpellBtn.addEventListener('click', () => {
    const level = customSpellLevel.value;
    const name = customSpellName.value.trim();
    
    if (!name) {
        alert('Please enter a spell name');
        return;
    }
    
    const levelKey = level === 'cantrip' ? 'cantrip' : `level${level}`;
    
    // Konwersja nazwy do formatu kebab-case
    const spellId = name.toLowerCase()
                      .replace(/[^\w\s-]/g, '') // Usuń znaki specjalne
                      .replace(/\s+/g, '-')     // Zamień spacje na myślniki
                      .replace(/-+/g, '-');     // Usuń podwójne myślniki
    
    if (!customSpells[levelKey]) {
        customSpells[levelKey] = [];
    }
    
    if (!customSpells[levelKey].includes(spellId)) {
        customSpells[levelKey].push(spellId);
        localStorage.setItem('customSpells', JSON.stringify(customSpells));
        
        if (!favorites.includes(spellId)) {
            favorites.push(spellId);
            localStorage.setItem('favoriteSpells', JSON.stringify(favorites));
        }
        
        fetchSpells();
    } else {
        alert('This spell already exists!');
    }
    
    customSpellModal.hide();
    customSpellName.value = '';
});

function openWikiLink(spellIndex, click) {
    const url = `https://dnd5e.wikidot.com/spell:${spellIndex}`;
    if (click == 1) {
        const newWindow = window.open('about:blank', '_blank');
        if (newWindow) {
            newWindow.location.href = url;
            setTimeout(() => {
                newWindow.blur();
                window.focus();
            }, 10);
        }
    }
    else if (click == 2) {
        window.open(url, '_blank');
    }
}

function updateProgress(spellName, totalForCurrentPhase = totalSpells) {
    // Jeśli zmieniono klasę, zresetuj postęp
    if (currentLoadingPhase === 'changed-class') {
        loadedSpells = 0;
        currentLoadingPhase = 'initial';
    }
    
    const progress = Math.min(Math.floor((loadedSpells / totalForCurrentPhase) * 100), 100);
    const progressBar = loadingProgressBar.querySelector('.progress-bar');
    const progressText = loadingProgressBar.querySelector('.progress-text');
    const currentSpell = loadingProgressBar.querySelector('.current-spell');
    
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${progress}%`;
    
    if (typeof spellName === 'string') {
        currentSpell.innerHTML = `${currentLoadingPhase === 'retry' ? 'Retrying: ' : 'Loading: '}${spellName}<br>(${loadedSpells}/${totalForCurrentPhase} spells)`;
    } else {
        currentSpell.textContent = spellName;
    }
}

async function loadSpecialities() {
    try {
        const response = await fetch('artificer_specialities.json');
        specialitySpells = await response.json();
    } catch (error) {
        console.error('Error loading specialities:', error);
        specialitySpells = {};
    }
}

async function fetchSpells() {
    try {
        const newClass = classSelect.value;
        if (currentClass !== newClass) {
            currentClass = newClass;
            currentLoadingPhase = 'changed-class';
            loadedSpells = 0;
        }

        document.body.classList.remove('finished');
        classSelect.setAttribute('disabled', '');
        levelSelect.setAttribute('disabled', '');
        addCustomSpellBtn.setAttribute('disabled', '');
        const isArtificer = classSelect.value === 'artificer';
        document.getElementById('specialitySelect').disabled = !isArtificer;
        document.getElementById('showSpecialities').disabled = !isArtificer;
        loadingSpinner.style.display = 'block';
        loadingSpinner.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2">Loading spells...</p>';
        
        if (!document.body.contains(loadingProgressBar)) {
            document.body.appendChild(loadingProgressBar);
        }
        
        // Zresetuj zmienne ładowania
        spellTable.innerHTML = '';
        currentLoadingPhase = 'initial';
        loadedSpells = 0;
        spells = []; // Czyścimy listę zaklęć

        const selectedClass = classSelect.value;
        localStorage.setItem('selectedClass', selectedClass);

        // Load spells based on selected class
        let spellsJSON = {};
        if (selectedClass === 'artificer') {
            const response = await fetch('artificer_spells.json');
            spellsJSON = await response.json();
        } else if (selectedClass === 'bard') {
            const response = await fetch('bard_spells.json');
            spellsJSON = await response.json();
        } else if (selectedClass === 'cleric') {
            const response = await fetch('cleric_spells.json');
            spellsJSON = await response.json();
        } else if (selectedClass === 'druid') {
            const response = await fetch('druid_spells.json');
            spellsJSON = await response.json();
        }

        const selectedLevel = levelSelect.value;
        localStorage.setItem('selectedLevel', selectedLevel);

        const selectedSpeciality = specialitySelect.value;
        localStorage.setItem('selectedSpeciality', selectedSpeciality);
        
        // Only load specialities for artificer
        if (selectedClass === 'artificer') {
            await loadSpecialities();
            
            if (selectedSpeciality !== 'none' && specialitySpells[selectedSpeciality]) {
                const speciality = specialitySpells[selectedSpeciality];
                for (const level in speciality) {
                    if (!spellsJSON[level]) spellsJSON[level] = [];
                    speciality[level].forEach(spell => {
                        if (!spellsJSON[level].includes(spell)) {
                            spellsJSON[level].push(spell);
                        }
                    });
                }
            }
        }
        
        // Dodaj własne spelle
        for (const level in customSpells) {
            if (!spellsJSON[level]) spellsJSON[level] = [];
            customSpells[level].forEach(spell => {
                if (!spellsJSON[level].includes(spell)) {
                    spellsJSON[level].push(spell);
                }
            });
        }

        for (const level in customSpells) {
            if (customSpells[level].length === 0) {
                delete customSpells[level];
            }
        }
        localStorage.setItem('customSpells', JSON.stringify(customSpells));

        const filteredSpellsJSON = {};
        if (selectedLevel === 'all') {
            Object.assign(filteredSpellsJSON, spellsJSON);
        } else if (selectedLevel === 'cantrip') {
            if (spellsJSON.cantrip) {
                filteredSpellsJSON.cantrip = spellsJSON.cantrip;
            }
        } else {
            const levelKey = `level${selectedLevel}`;
            if (spellsJSON[levelKey]) {
                filteredSpellsJSON[levelKey] = spellsJSON[levelKey];
            }
        }

        const flattened = [];
        for (const level in filteredSpellsJSON) {
            for (const spellName of filteredSpellsJSON[level]) {
                // Upewnij się, że spellName jest stringiem
                const spellNameStr = typeof spellName === 'string' ? spellName : JSON.stringify(spellName);
                
                const isSpeciality = selectedSpeciality !== 'none' && 
                    specialitySpells[selectedSpeciality] && 
                    Object.values(specialitySpells[selectedSpeciality])
                        .flat()
                        .includes(spellNameStr);

                const requiredLevel = isSpeciality ? 
                    getRequiredLevel(selectedSpeciality, spellNameStr) : 0;
                
                flattened.push({
                    name: spellNameStr.replace(/-/g, ' '),
                    index: spellNameStr,
                    sourceLevel: level,
                    foundInAPI: false,
                    isSpeciality,
                    requiredLevel
                });
            }
        }

        spells = flattened;
        loadedSpells = 0;
        totalSpells = flattened.length;
        updateProgress('Loading spells...');

        const BATCH_SIZE = 30;
        const DELAY_BETWEEN_BATCHES = 1000;
        
        for (let i = 0; i < flattened.length; i += BATCH_SIZE) {
            const batch = flattened.slice(i, i + BATCH_SIZE);
            await processBatch(batch, flattened.length);
            
            if (i + BATCH_SIZE < flattened.length) {
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
            }
        }

        const failedSpells = spells.filter(s => !s.foundInAPI);
        if (failedSpells.length > 0) {
            currentLoadingPhase = 'retry';
            loadedSpells = 0;
            totalSpells = failedSpells.length;
            updateProgress(`Retrying ${failedSpells.length} failed spells...`);
            await retryFailedSpells(failedSpells);
        }
        
        loadingSpinner.style.display = 'none';
        loadingSpinner.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2">Loading spells...</p>';
        loadingProgressBar.remove();
        document.body.classList.add('finished');
        classSelect.removeAttribute('disabled');
        levelSelect.removeAttribute('disabled');
        addCustomSpellBtn.removeAttribute('disabled');
        renderSpellTable();
    } catch (error) {
        console.error('Error fetching spells:', error);
        loadingSpinner.innerHTML = '<div class="alert alert-danger">Failed to load spells. Please try again later.</div>';
        loadingProgressBar.remove();

        const retryButton = document.createElement('button');
        retryButton.className = 'btn btn-primary mt-2';
        retryButton.textContent = 'Retry';
        retryButton.addEventListener('click', fetchSpells);
        loadingSpinner.appendChild(retryButton);
    }
}

async function processBatch(batch, totalForPhase) {
    const promises = batch.map(spell => 
        fetch(`https://www.dnd5eapi.co/api/spells/${spell.index}`)
            .then(async response => {
                if (response.ok) {
                    const data = await response.json();
                    const spellIndex = spells.findIndex(s => s.index === spell.index);
                    if (spellIndex !== -1) {
                        spells[spellIndex] = { ...spells[spellIndex], ...data, foundInAPI: true };
                    }
                }
                loadedSpells++;
                updateProgress(spell.name, totalForPhase);
                return null;
            })
            .catch(error => {
                console.error(`Error fetching spell ${spell.index}:`, error);
                loadedSpells++;
                updateProgress(spell.name, totalForPhase);
                return null;
            })
    );
    await Promise.all(promises);
    renderSpellTable()
}

async function retryFailedSpells(failedSpells) {
    try {

        currentLoadingPhase = 'retry';
        loadedSpells = 0;
        totalSpells = failedSpells.length;
        
        // Zresetuj spinner do stanu początkowego
        loadingSpinner.style.display = 'block';
        loadingSpinner.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2">Retrying failed spells...</p>';
        
        updateProgress(`Retrying ${failedSpells.length} failed spells...`);
        
        const BATCH_SIZE = 10;
        const DELAY_BETWEEN_BATCHES = 1000;
        
        for (let i = 0; i < failedSpells.length; i += BATCH_SIZE) {
            const batch = failedSpells.slice(i, i + BATCH_SIZE);
            await processBatch(batch);
            
            if (i + BATCH_SIZE < failedSpells.length) {
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
            }
        }
    } catch (error){
        console.error('Error retrying spells:', error);
        loadingSpinner.innerHTML = '<div class="alert alert-danger">Failed to retry spells. Please try again later.</div>';
        
        // Przycisk do ponowienia
        const retryButton = document.createElement('button');
        retryButton.className = 'btn btn-primary mt-2';
        retryButton.textContent = 'Retry';
        retryButton.addEventListener('click', () => retryFailedSpells(failedSpells));
        loadingSpinner.appendChild(retryButton);
    }
}

function getComponentsString(spell) {
    if (!spell.components) return '';
    return spell.components.map(comp => {
        if (comp === 'M') {
            return 'M' + (spell.material ? ` (${spell.material})` : '');
        }
        return comp;
    }).join(', ');
}

function getShortComponentsString(spell) {
    if (!spell.components) return '';
    return spell.components.join(', ');
}

let showSpecialitiesOnly = false;

function formatSpellName(name) {
    return name.replace(/-/g, ' ')
               .replace(/\b\w/g, l => l.toUpperCase());
}

function removeCustomSpell(spellIndex) {
    for (const level in customSpells) {
        customSpells[level] = customSpells[level].filter(s => s !== spellIndex);
    }
    
    favorites = favorites.filter(f => f !== spellIndex);
    
    localStorage.setItem('customSpells', JSON.stringify(customSpells));
    localStorage.setItem('favoriteSpells', JSON.stringify(favorites));
    
    fetchSpells();
}

function formatSpecialityName(speciality) {
    return speciality.replace(/-/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
}

function isCustomSpell(spellIndex) {
    return Object.values(customSpells).flat().includes(spellIndex);
}


function getRequiredLevel(speciality, spellName) {
    if (!speciality || !specialitySpells[speciality]) return 0;
    
    for (const levelReq in specialitySpells[speciality]) {
        if (specialitySpells[speciality][levelReq].includes(spellName)) {
            return parseInt(levelReq.replace('level', ''));
        }
    }
    return 0;
}

function renderSpellTable(filteredSpells = null) {
    spellTable.innerHTML = '';
    const spellsToRender = (filteredSpells || spells).filter(spell => {
        const isCustom = Object.values(customSpells).flat().includes(spell.index);
        const isSpeciality = spell.isSpeciality;
        const isNonCantrip = spell.sourceLevel !== 'cantrip';
        
        return (!showNonCantripsOnly || isNonCantrip) &&
               (!showFavoritesOnly || favorites.includes(spell.index)) &&
               (!showCustomOnly || isCustom) &&
               (!showSpecialitiesOnly || isSpeciality);
    });

    const grouped = {};
    spellsToRender.forEach(spell => {
        let levelLabel = spell.sourceLevel === 'cantrip'
            ? 'Cantrip'
            : `Level ${spell.sourceLevel.replace('level', '')}`;
        if (spell.isSpeciality) {
            if (spell.sourceLevel == 'level3'){
                levelLabel = 'Level 1';
            } else if (spell.sourceLevel == 'level5'){
                levelLabel = 'Level 2';
            } else if (spell.sourceLevel == 'level9'){
                levelLabel = 'Level 3';
            } else if (spell.sourceLevel == 'level13'){
                levelLabel = 'Level 4';
            } else {
                levelLabel = 'Level 5';
            }
        }
        if (!grouped[levelLabel]) grouped[levelLabel] = [];
        grouped[levelLabel].push(spell);
    });

    for (const level in grouped) {
        const section = document.createElement('div');
        section.className = 'col-12 spell-level';

        const header = document.createElement('h3');
        header.textContent = level;
        section.appendChild(header);

        const spellsContainer = document.createElement('div');
        spellsContainer.className = 'spells-container';
        
        grouped[level]
            .sort((a, b) => {
                const aFavorite = favorites.includes(a.index);
                const bFavorite = favorites.includes(b.index);
                if (aFavorite && !bFavorite) return -1;
                if (!aFavorite && bFavorite) return 1;
                return a.name.localeCompare(b.name);
            })
            .forEach(spell => {
                const isFavorite = favorites.includes(spell.index);
                const notInAPI = !spell.foundInAPI;
                const isCustom = Object.values(customSpells).flat().includes(spell.index);
                const div = document.createElement('div');
                const displayName = spell.name.replace(/-/g, ' '); // Zamienia "spell-name" na "spell name"
                const formattedName = displayName.replace(/\b\w/g, l => l.toUpperCase());
                div.className = `spell-item d-flex justify-content-between align-items-center ${
                    isFavorite ? 'favorite' : ''} ${
                    notInAPI ? 'not-in-api' : ''} ${
                    spell.isSpeciality ? 'speciality-spell' : ''} ${
                    isCustom ? 'custom-spell' : ''}`;
                
                const components = spell.foundInAPI ? getShortComponentsString(spell) : '';
                const componentsDisplay = components ? ` <span class="components">(${components})</span>` : '';
                const specialityName = formatSpecialityName(specialitySelect.value);
                const requiredLevel = spell.isSpeciality ? 
                    getRequiredLevel(specialitySelect.value, spell.index) : 0;

                const specialityBadge = spell.isSpeciality ? 
                    `<span class="badge bg-info ms-2">${specialityName} - lvl ${requiredLevel}</span>` : '';
                const removeBtn = isCustom ? `<button class="btn btn-sm btn-outline-danger remove-spell-btn ms-2" data-index="${spell.index}"><i class="bi bi-trash"></i></button>` : '';
                
                const isPrepared = preparedSpells.includes(spell.index);
                const isFree = freePreparedSpells.includes(spell.index) || spell.isSpeciality;
                
                const concentrationIcon = spell.concentration ? '<i class="bi bi-c-circle concentration-icon" title="Requires concentration"></i>' : '';

                div.innerHTML = `
                    <div class="spell-name-container">
                        ${concentrationIcon}
                        <span class="spell-name" style="${notInAPI ? 'font-style: italic;' : ''}">${formattedName}</span>
                        ${componentsDisplay}
                        ${specialityBadge}
                    </div>
                    <i class="bi bi-plus-circle prepare-btn ${isPrepared ? 'active' : ''}" data-index="${spell.index}"></i>
                    ${removeBtn}
                    <i class="bi bi-star favorite-btn ${isFavorite ? 'active' : ''}" data-index="${spell.index}"></i>
                `;

                const spellName = div.querySelector('.spell-name');
                spellName.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    openWikiLink(spell.index, 1);
                });

                spellName.addEventListener('click', (e) => {
                    openWikiLink(spell.index, 2);
                });

                spellName.addEventListener('auxclick', (e) => {
                    if (e.button === 1) {
                        e.preventDefault();
                    }
                });
                
                const starBtn = div.querySelector('.favorite-btn');
                starBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = e.target.dataset.index;
                    toggleFavorite(index);
                });
                
                div.addEventListener('click', (e) => {
                    if (e.target === div) showTooltip(spell);
                });

                const prepareBtn = div.querySelector('.prepare-btn');
                prepareBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = e.target.dataset.index;
                    togglePreparedSpell(index);
                });
                
                spellsContainer.appendChild(div);
            });

        section.appendChild(spellsContainer);
        spellTable.appendChild(section);
    }

    document.querySelectorAll('.remove-spell-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const spellIndex = e.currentTarget.dataset.index;
            removeCustomSpell(spellIndex);
        });
    });
}

function toggleFavorite(index) {
    if (favorites.includes(index)) {
        favorites = favorites.filter(fav => fav !== index);
    } else {
        favorites.push(index);
    }
    localStorage.setItem('favoriteSpells', JSON.stringify(favorites));
    renderSpellTable();
}

function showTooltip(spell) {
    if (!spell.foundInAPI) {
        spellTooltip.style.display = 'none';
        return;
    }
    const concentrationInfo = spell.concentration ? 
        '<p class="concentration"><strong>Requires Concentration:</strong> Yes</p>' : 
        '<p><strong>Requires Concentration:</strong> No</p>';

    let higherLevelsInfo = '';
    if (spell.higher_level && spell.higher_level.length > 0) {
        higherLevelsInfo = `
            <div class="higher-levels">
                <p><strong>At Higher Levels:</strong></p>
                <p>${spell.higher_level.join('<br>')}</p>
            </div>
        `;
    }

    spellTooltip.innerHTML = `
        <h5>${spell.name}</h5>
        <p><strong>Level:</strong> ${spell.level === 0 ? 'Cantrip' : spell.level}</p>
        <p><strong>School:</strong> ${spell.school.name}</p>
        <p><strong>Range:</strong> ${spell.range}</p>
        <p><strong>Components:</strong> <span class="components">${getComponentsString(spell)}</span></p>
        <p><strong>Duration:</strong> ${spell.duration}</p>
        ${concentrationInfo}
        <p><strong>Casting Time:</strong> ${spell.casting_time}</p>
        <p>${spell.desc ? spell.desc.join('<br>') : ''}</p>
        ${higherLevelsInfo}
    `;
    spellTooltip.style.display = 'block';
}

function hideTooltip() {
    spellTooltip.style.display = 'none';
    document.querySelectorAll('.spell-item').forEach(item => {
        item.classList.remove('tooltip-active');
    });
}

levelSelect.addEventListener('change', () => {
    currentLevel = levelSelect.value;
    localStorage.setItem('selectedLevel', currentLevel);
    fetchSpells();
});
specialitySelect.addEventListener('change', fetchSpells);
spellSearch.addEventListener('input', () => {
    const query = spellSearch.value.toLowerCase().trim();
    renderSpellTable(spells.filter(spell => spell.name.toLowerCase().includes(query)));
});

showFavoritesBtn.addEventListener('click', () => {
    showFavoritesOnly = !showFavoritesOnly;
    showFavoritesBtn.classList.toggle('btn-warning', showFavoritesOnly);
    showFavoritesBtn.classList.toggle('btn-outline-warning', !showFavoritesOnly);
    renderSpellTable();
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.spell-item') && !e.target.closest('#spellTooltip')) {
        hideTooltip();
    }
});

document.getElementById('showSpecialities').addEventListener('click', () => {
    showSpecialitiesOnly = !showSpecialitiesOnly;
    const btn = document.getElementById('showSpecialities');
    btn.classList.toggle('btn-info', showSpecialitiesOnly);
    btn.classList.toggle('btn-outline-info', !showSpecialitiesOnly);
    renderSpellTable();
});

specialitySelect.value = localStorage.getItem('selectedSpeciality') || 'none';
levelSelect.value = localStorage.getItem('selectedLevel') || 'all';

let preparedSpells = JSON.parse(localStorage.getItem('preparedSpells')) || [];
let freePreparedSpells = JSON.parse(localStorage.getItem('freePreparedSpells')) || [];


// Inicjalizacja panelu przygotowanych spellów
const preparedSpellsPanel = document.getElementById('preparedSpellsPanel');
const preparedPanelHandle = document.getElementById('preparedPanelHandle');
const preparedSpellsList = document.getElementById('preparedSpellsList');
const preparedCount = document.getElementById('preparedCount');
const exportPreparedBtn = document.getElementById('exportPreparedBtn');
const importPreparedBtn = document.getElementById('importPreparedBtn');
const importPreparedInput = document.getElementById('importPreparedInput');

// Obsługa panelu przygotowanych spellów
preparedPanelHandle.addEventListener('click', () => {
    preparedSpellsPanel.classList.toggle('collapsed');
});

// Funkcja do aktualizacji listy przygotowanych spellów
function updatePreparedSpellsList() {
    preparedSpellsList.innerHTML = '';
    preparedCount.textContent = preparedSpells.filter(spell => !freePreparedSpells.includes(spell)).length;
    
    preparedSpells.forEach(spellIndex => {
        const spell = spells.find(s => s.index === spellIndex) || { 
            name: spellIndex.replace(/-/g, ' '),
            index: spellIndex,
            sourceLevel: 'custom'
        };
        
        const isFree = freePreparedSpells.includes(spellIndex);
        const isSpeciality = spell.isSpeciality;
        
        const spellEl = document.createElement('div');
        spellEl.className = 'prepared-spell';
        spellEl.innerHTML = `
            <div class="prepared-spell-name">
                ${spell.name}
                ${isSpeciality ? '<span class="badge bg-info ms-2">Speciality</span>' : ''}
                ${isFree ? '<span class="badge bg-success ms-2">Free</span>' : ''}
            </div>
            <div class="prepared-spell-actions">
                <button class="btn btn-sm ${isFree ? 'btn-success' : 'btn-outline-success'}" 
                    onclick="toggleFreePrepared('${spellIndex}')">
                    <i class="bi ${isFree ? 'bi-check-circle-fill' : 'bi-check-circle'}"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" 
                    onclick="removePreparedSpell('${spellIndex}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        
        preparedSpellsList.appendChild(spellEl);
    });
    
    localStorage.setItem('preparedSpells', JSON.stringify(preparedSpells));
    localStorage.setItem('freePreparedSpells', JSON.stringify(freePreparedSpells));
}

// Funkcje do zarządzania przygotowanymi spellami
function togglePreparedSpell(spellIndex) {
    const index = preparedSpells.indexOf(spellIndex);
    const spell = spells.find(s => s.index === spellIndex);
    
    if (index === -1) {
        preparedSpells.push(spellIndex);
        // Automatically mark speciality spells as free
        if (spell && spell.isSpeciality) {
            const freeIndex = freePreparedSpells.indexOf(spellIndex);
            if (freeIndex === -1) {
                freePreparedSpells.push(spellIndex);
            }
        }
    } else {
        preparedSpells.splice(index, 1);
        // Remove from free spells if it was there
        const freeIndex = freePreparedSpells.indexOf(spellIndex);
        if (freeIndex !== -1) {
            freePreparedSpells.splice(freeIndex, 1);
        }
    }
    updatePreparedSpellsList();
}

function toggleFreePrepared(spellIndex) {
    const index = freePreparedSpells.indexOf(spellIndex);
    if (index === -1) {
        freePreparedSpells.push(spellIndex);
    } else {
        freePreparedSpells.splice(index, 1);
    }
    updatePreparedSpellsList();
}

function removePreparedSpell(spellIndex) {
    preparedSpells = preparedSpells.filter(s => s !== spellIndex);
    freePreparedSpells = freePreparedSpells.filter(s => s !== spellIndex);
    updatePreparedSpellsList();
}

exportPreparedBtn.addEventListener('click', () => {
    const data = {
        preparedSpells,
        freePreparedSpells,
        timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `prepared-spells-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
});

importPreparedBtn.addEventListener('click', () => {
    importPreparedInput.click();
});

importPreparedInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (data.preparedSpells && Array.isArray(data.preparedSpells)) {
                preparedSpells = data.preparedSpells;
                freePreparedSpells = data.freePreparedSpells || [];
                updatePreparedSpellsList();
            }
        } catch (error) {
            console.error('Error importing prepared spells:', error);
            alert('Invalid file format');
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
});

function updateLevelSelect() {
    levelSelect.innerHTML = `
        <option value="all">All Levels</option>
        <option value="cantrip">Cantrips</option>
        <option value="1">Level 1</option>
        <option value="2">Level 2</option>
        <option value="3">Level 3</option>
        <option value="4">Level 4</option>
        <option value="5">Level 5</option>
    `;

    if (currentClass !== 'artificer') {
        levelSelect.innerHTML += `
            <option value="6">Level 6</option>
            <option value="7">Level 7</option>
            <option value="8">Level 8</option>
            <option value="9">Level 9</option>
        `;
    }

    const savedLevel = localStorage.getItem('selectedLevel');
    if (savedLevel && levelSelect.querySelector(`option[value="${savedLevel}"]`)) {
        levelSelect.value = savedLevel;
    } else {
        levelSelect.value = 'all';
    }
}

classSelect.addEventListener('change', () => {
    // Zresetuj zmienne związane z ładowaniem
    currentLoadingPhase = 'initial';
    loadedSpells = 0;
    totalSpells = 0;

    currentClass = classSelect.value;
    localStorage.setItem('selectedClass', currentClass);
    
    // Zaktualizuj UI
    updateProgress('Preparing to load spells...');
    loadingSpinner.style.display = 'block';
    spellTable.innerHTML = '';
    
    // Wywołaj resztę logiki
    updateLevelSelect();

    // Załaduj nowe zaklęcia
    fetchSpells();
});

classSelect.value = localStorage.getItem('selectedClass') || 'artificer';

updatePreparedSpellsList()
preparedSpellsPanel.classList.toggle('collapsed');
