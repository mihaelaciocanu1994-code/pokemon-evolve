'use strict';

// -----------------------------
// Configuration and DOM helpers
// -----------------------------
const API_BASE = 'https://pokeapi.co/api/v2';

const TYPE_COLORS = {
  normal: 'var(--type-normal)', fire: 'var(--type-fire)', water: 'var(--type-water)',
  electric: 'var(--type-electric)', grass: 'var(--type-grass)', ice: 'var(--type-ice)',
  fighting: 'var(--type-fighting)', poison: 'var(--type-poison)', ground: 'var(--type-ground)',
  flying: 'var(--type-flying)', psychic: 'var(--type-psychic)', bug: 'var(--type-bug)',
  rock: 'var(--type-rock)', ghost: 'var(--type-ghost)', dragon: 'var(--type-dragon)',
  dark: 'var(--type-dark)', steel: 'var(--type-steel)', fairy: 'var(--type-fairy)'
};

const STAT_LABELS = {
  hp: 'HP', attack: 'Atk', defense: 'Def',
  'special-attack': 'SpA', 'special-defense': 'SpD', speed: 'Spe'
};

const els = {
  form: document.querySelector('#search-form'),
  pokemonInput: document.querySelector('#pokemon-input'),
  levelInput: document.querySelector('#level-input'),
  empty: document.querySelector('#empty-state'),
  loading: document.querySelector('#loading-state'),
  error: document.querySelector('#error-state'),
  errorTitle: document.querySelector('#error-title'),
  errorMessage: document.querySelector('#error-message'),
  results: document.querySelector('#results'),
  verdict: document.querySelector('#verdict-card'),
  current: document.querySelector('#current-pokemon'),
  evolutionSection: document.querySelector('#evolution-section'),
  evolutionOptions: document.querySelector('#evolution-options'),
  evolutionCount: document.querySelector('#evolution-count')
};

let currentResult = null;
let requestToken = 0;

function titleCase(value = '') {
  return value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

function showState(state, message = {}) {
  els.empty.classList.toggle('hidden', state !== 'empty');
  els.loading.classList.toggle('hidden', state !== 'loading');
  els.error.classList.toggle('hidden', state !== 'error');
  els.results.classList.toggle('hidden', state !== 'results');

  if (state === 'error') {
    els.errorTitle.textContent = message.title || 'Something went wrong';
    els.errorMessage.textContent = message.body || 'Please try again.';
  }
}

// -----------------------------
// PokéAPI data access
// -----------------------------
async function fetchJson(url) {
  let response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (error) {
    throw new Error('NETWORK_ERROR');
  }

  if (response.status === 404) throw new Error('NOT_FOUND');
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.json();
}

async function fetchPokemon(query) {
  const normalized = String(query).trim().toLowerCase();
  return fetchJson(`${API_BASE}/pokemon/${encodeURIComponent(normalized)}`);
}

async function fetchSpecies(speciesUrl) {
  return fetchJson(speciesUrl);
}

async function fetchEvolutionChain(chainUrl) {
  return fetchJson(chainUrl);
}

async function fetchPokemonBySpeciesName(speciesName) {
  return fetchJson(`${API_BASE}/pokemon/${encodeURIComponent(speciesName)}`);
}

function getArtwork(pokemon) {
  return pokemon?.sprites?.other?.['official-artwork']?.front_default
    || pokemon?.sprites?.other?.home?.front_default
    || pokemon?.sprites?.front_default
    || null;
}

function normalizePokemon(pokemon) {
  const stats = Object.fromEntries(
    pokemon.stats.map(entry => [entry.stat.name, entry.base_stat])
  );

  return {
    id: pokemon.id,
    name: pokemon.name,
    speciesName: pokemon.species.name,
    image: getArtwork(pokemon),
    types: pokemon.types.sort((a, b) => a.slot - b.slot).map(entry => entry.type.name),
    stats,
    baseStatTotal: Object.values(stats).reduce((sum, stat) => sum + stat, 0)
  };
}

// Find the exact species node inside a branching evolution tree.
function findSpeciesNode(node, speciesName) {
  if (!node) return null;
  if (node.species.name === speciesName) return node;

  for (const child of node.evolves_to || []) {
    const match = findSpeciesNode(child, speciesName);
    if (match) return match;
  }
  return null;
}

// -----------------------------
// Evolution requirement parsing
// -----------------------------
function formatGender(genderId) {
  if (genderId === 1) return 'female';
  if (genderId === 2) return 'male';
  return `gender ID ${genderId}`;
}

function formatRelativeStats(value) {
  if (value === 1) return 'Attack must be higher than Defense';
  if (value === -1) return 'Attack must be lower than Defense';
  return 'Attack and Defense must be equal';
}

function parseEvolutionDetail(detail = {}) {
  const requirements = [];
  const trigger = detail.trigger?.name;

  if (trigger === 'trade') requirements.push('Trade this Pokémon');
  else if (trigger === 'shed') requirements.push('Special evolution that occurs through shedding');
  else if (trigger === 'spin') requirements.push('Perform the required spin action');
  else if (trigger === 'tower-of-darkness') requirements.push('Complete the Tower of Darkness requirement');
  else if (trigger === 'tower-of-waters') requirements.push('Complete the Tower of Waters requirement');
  else if (trigger === 'three-critical-hits') requirements.push('Land three critical hits in one battle');
  else if (trigger === 'take-damage') requirements.push('Meet the required damage-taking condition');
  else if (trigger && trigger !== 'level-up' && trigger !== 'use-item' && trigger !== 'agile-style-move' && trigger !== 'strong-style-move' && trigger !== 'recoil-damage') {
    requirements.push(`Trigger evolution by: ${titleCase(trigger)}`);
  }

  if (detail.item) requirements.push(`Use a ${titleCase(detail.item.name)}`);
  if (detail.held_item) requirements.push(`Hold a ${titleCase(detail.held_item.name)} when the evolution is triggered`);
  if (detail.min_level != null) requirements.push(`Reach at least level ${detail.min_level}`);
  if (detail.min_happiness != null) requirements.push(`Reach at least ${detail.min_happiness} friendship/happiness`);
  if (detail.min_affection != null) requirements.push(`Reach at least ${detail.min_affection} affection`);
  if (detail.min_beauty != null) requirements.push(`Reach at least ${detail.min_beauty} beauty`);
  if (detail.time_of_day) requirements.push(`Trigger the evolution during the ${titleCase(detail.time_of_day)}`);
  if (detail.location) requirements.push(`Trigger the evolution at ${titleCase(detail.location.name)}`);
  if (detail.known_move) requirements.push(`Know the move ${titleCase(detail.known_move.name)}`);
  if (detail.known_move_type) requirements.push(`Know a ${titleCase(detail.known_move_type.name)}-type move`);
  if (detail.party_species) requirements.push(`Have ${titleCase(detail.party_species.name)} in the party`);
  if (detail.party_type) requirements.push(`Have a ${titleCase(detail.party_type.name)}-type Pokémon in the party`);
  if (detail.trade_species) requirements.push(`Trade for ${titleCase(detail.trade_species.name)}`);
  if (detail.gender != null) requirements.push(`Pokémon must be ${formatGender(detail.gender)}`);
  if (detail.relative_physical_stats != null) requirements.push(formatRelativeStats(detail.relative_physical_stats));
  if (detail.needs_overworld_rain) requirements.push('It must be raining in the overworld');
  if (detail.near_special_rock) requirements.push('Be near the required Moss Rock or Ice Rock');
  if (detail.needs_multiplayer) requirements.push('Use the required multiplayer/link-play condition');
  if (detail.turn_upside_down) requirements.push('Turn the system upside down while triggering the evolution');
  if (detail.region) requirements.push(`Be in the ${titleCase(detail.region.name)} region`);
  if (detail.base_form) requirements.push(`Use the ${titleCase(detail.base_form.name)} form`);
  if (detail.used_move) {
    const countText = detail.min_move_count ? ` at least ${detail.min_move_count} times` : '';
    requirements.push(`Use ${titleCase(detail.used_move.name)}${countText}`);
  }
  if (detail.min_steps != null) requirements.push(`Take at least ${detail.min_steps} required steps`);
  if (detail.min_damage_taken != null) requirements.push(`Take at least ${detail.min_damage_taken} damage under the required conditions`);
  if (trigger === 'agile-style-move') requirements.push('Use the required move in Agile Style enough times');
  if (trigger === 'strong-style-move') requirements.push('Use the required move in Strong Style enough times');
  if (trigger === 'recoil-damage') requirements.push('Accumulate the required recoil damage');

  if (requirements.length === 0) requirements.push('Meet this evolution’s special in-game requirement');

  return {
    requirements,
    minLevel: detail.min_level ?? null,
    hasNonLevelRequirements: requirements.some(text => !text.startsWith('Reach at least level'))
  };
}

function buildRoutes(evolutionNode) {
  const details = evolutionNode.evolution_details || [];

  if (!details.length) {
    return [{
      requirements: ['No additional requirement is listed by PokéAPI'],
      minLevel: null,
      hasNonLevelRequirements: false
    }];
  }

  // Multiple evolution_detail objects are alternative routes (OR), while fields
  // inside one detail are requirements that generally need to be met together (AND).
  return details.map(parseEvolutionDetail);
}

function getCurrentLevel() {
  const raw = els.levelInput.value.trim();
  if (!raw) return null;
  const level = Number(raw);
  return Number.isFinite(level) && level >= 1 && level <= 100 ? level : null;
}

function evaluateRoute(route, currentLevel) {
  if (route.minLevel != null && currentLevel != null && currentLevel < route.minLevel) {
    return { state: 'wait', text: `Not yet at level ${currentLevel} — level ${route.minLevel} is required.` };
  }

  if (route.minLevel != null && currentLevel == null) {
    return { state: 'conditional', text: `Enter the current level to verify the level ${route.minLevel} requirement.` };
  }

  if (route.hasNonLevelRequirements) {
    return {
      state: 'conditional',
      text: currentLevel != null && route.minLevel != null
        ? 'Your level is high enough; evolve once the other listed requirement(s) are met.'
        : 'Evolve once the listed requirement(s) are met.'
    };
  }

  return { state: 'ready', text: 'This route is ready based on the information provided.' };
}

function routePriority(state) {
  return ({ ready: 3, conditional: 2, wait: 1 })[state] || 0;
}

// -----------------------------
// Decision logic
// -----------------------------
function makeVerdict(current, evolutions, currentLevel) {
  if (!evolutions.length) {
    return {
      tone: 'final',
      chip: 'Final form',
      title: `${titleCase(current.name)} has no further evolution.`,
      body: 'There is nothing further to evolve into in this evolution chain.'
    };
  }

  const routeChecks = evolutions.flatMap(evolution =>
    evolution.routes.map(route => ({
      ...evaluateRoute(route, currentLevel),
      evolution
    }))
  );

  routeChecks.sort((a, b) => routePriority(b.state) - routePriority(a.state));
  const best = routeChecks[0];
  const maxGain = Math.max(...evolutions.map(e => e.baseStatTotal - current.baseStatTotal));
  const statMessage = maxGain >= 0
    ? `The strongest immediate option gains ${maxGain} points in base stat total.`
    : `The next form changes base stat total by ${maxGain} points.`;

  if (best.state === 'ready') {
    return {
      tone: 'yes',
      chip: 'Evolve now',
      title: 'Yes — evolving now is a strong default choice.',
      body: `${best.text} ${statMessage} Consider waiting only if you want an unevolved-form move earlier in your specific game.`
    };
  }

  if (best.state === 'wait') {
    return {
      tone: 'wait',
      chip: 'Wait',
      title: 'Not yet — you have not met the level requirement.',
      body: `${best.text} ${statMessage}`
    };
  }

  return {
    tone: 'conditional',
    chip: 'Conditional',
    title: 'Evolve when the listed requirement is satisfied.',
    body: `${best.text} ${statMessage}`
  };
}

// -----------------------------
// Rendering
// -----------------------------
function renderTypeBadges(types) {
  return types.map(type => {
    const color = TYPE_COLORS[type] || '#777';
    return `<span class="type-badge type-${escapeHtml(type)}" style="background:${color}">${escapeHtml(type)}</span>`;
  }).join('');
}

function renderStats(stats, total) {
  const rows = Object.entries(STAT_LABELS).map(([key, label]) => {
    const value = stats[key] ?? 0;
    const percent = Math.min((value / 180) * 100, 100);
    return `
      <div class="stat-row">
        <span class="stat-name">${label}</span>
        <span class="stat-value">${value}</span>
        <div class="stat-track" aria-label="${label}: ${value}">
          <div class="stat-fill" style="width:${percent.toFixed(1)}%"></div>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="stats-header">
      <h3>Base stats</h3>
      <span class="bst">Total: <strong>${total}</strong></span>
    </div>
    <div class="stats-list">${rows}</div>`;
}

function renderImage(image, name) {
  if (!image) return `<div class="image-fallback">No image available</div>`;
  return `<img src="${escapeHtml(image)}" alt="Official artwork of ${escapeHtml(titleCase(name))}" loading="lazy">`;
}

function renderCurrentPokemon(pokemon) {
  els.current.innerHTML = `
    <article class="pokemon-card">
      <div class="pokemon-visual">${renderImage(pokemon.image, pokemon.name)}</div>
      <div class="pokemon-content">
        <div class="pokemon-title-row">
          <h3 class="pokemon-name">${escapeHtml(titleCase(pokemon.name))}</h3>
          <span class="dex-number">#${String(pokemon.id).padStart(4, '0')}</span>
        </div>
        <div class="type-row">${renderTypeBadges(pokemon.types)}</div>
        ${renderStats(pokemon.stats, pokemon.baseStatTotal)}
      </div>
    </article>`;
}

function renderRoute(route, currentLevel, index, totalRoutes) {
  const evaluation = evaluateRoute(route, currentLevel);
  const routeLabel = totalRoutes > 1 ? `<p class="requirements-title">Route ${index + 1}</p>` : '<p class="requirements-title">Requirements</p>';
  const items = route.requirements.map(req => `<li>${escapeHtml(req)}</li>`).join('');

  return `
    <div class="requirement-route">
      ${routeLabel}
      <ul class="requirements-list">${items}</ul>
      <div class="route-status ${evaluation.state}">${escapeHtml(evaluation.text)}</div>
    </div>`;
}

function renderEvolutionCard(evolution, current, currentLevel) {
  const delta = evolution.baseStatTotal - current.baseStatTotal;
  const deltaClass = delta < 0 ? 'negative' : '';
  const deltaSign = delta > 0 ? '+' : '';

  return `
    <article class="evolution-card">
      <div class="evolution-card-inner">
        <div class="evolution-card-top">
          <div class="evolution-image-wrap">${renderImage(evolution.image, evolution.name)}</div>
          <div>
            <h3>${escapeHtml(titleCase(evolution.name))}</h3>
            <div class="type-row">${renderTypeBadges(evolution.types)}</div>
            <span class="bst">Base stat total: <strong>${evolution.baseStatTotal}</strong></span>
          </div>
        </div>
        <div class="stat-delta ${deltaClass}">Base stat total change: ${deltaSign}${delta}</div>
        ${renderStats(evolution.stats, evolution.baseStatTotal)}
        <div style="height:18px"></div>
        ${evolution.routes.map((route, i) => renderRoute(route, currentLevel, i, evolution.routes.length)).join('<div style="height:16px"></div>')}
      </div>
    </article>`;
}

function renderVerdict(current, evolutions) {
  const currentLevel = getCurrentLevel();
  const verdict = makeVerdict(current, evolutions, currentLevel);
  els.verdict.dataset.tone = verdict.tone;
  els.verdict.innerHTML = `
    <div class="verdict-topline">
      <div>
        <p class="verdict-label">Verdict</p>
        <h2>${escapeHtml(verdict.title)}</h2>
        <p>${escapeHtml(verdict.body)}</p>
      </div>
      <span class="verdict-chip">${escapeHtml(verdict.chip)}</span>
    </div>`;
}

function renderAll(result) {
  const { current, evolutions } = result;
  const level = getCurrentLevel();

  renderVerdict(current, evolutions);
  renderCurrentPokemon(current);

  if (!evolutions.length) {
    els.evolutionCount.textContent = 'No next stage';
    els.evolutionOptions.innerHTML = `
      <div class="final-form-card">
        <h3>${escapeHtml(titleCase(current.name))} is a final form.</h3>
        <p>PokéAPI lists no further evolution from this point in the chain.</p>
      </div>`;
  } else {
    els.evolutionCount.textContent = `${evolutions.length} next evolution${evolutions.length === 1 ? '' : 's'}`;
    els.evolutionOptions.innerHTML = evolutions
      .map(evolution => renderEvolutionCard(evolution, current, level))
      .join('');
  }

  showState('results');
}

// -----------------------------
// Search orchestration
// -----------------------------
async function loadPokemon(query) {
  const token = ++requestToken;
  showState('loading');
  currentResult = null;

  try {
    const pokemonRaw = await fetchPokemon(query);
    if (token !== requestToken) return;

    const species = await fetchSpecies(pokemonRaw.species.url);
    if (token !== requestToken) return;

    const chain = await fetchEvolutionChain(species.evolution_chain.url);
    if (token !== requestToken) return;

    const current = normalizePokemon(pokemonRaw);
    const currentNode = findSpeciesNode(chain.chain, pokemonRaw.species.name);

    if (!currentNode) throw new Error('CHAIN_MISMATCH');

    const nextNodes = currentNode.evolves_to || [];
    const nextPokemonRaw = await Promise.all(
      nextNodes.map(node => fetchPokemonBySpeciesName(node.species.name))
    );
    if (token !== requestToken) return;

    const evolutions = nextNodes.map((node, index) => ({
      ...normalizePokemon(nextPokemonRaw[index]),
      routes: buildRoutes(node)
    }));

    currentResult = { current, evolutions };
    renderAll(currentResult);
  } catch (error) {
    if (token !== requestToken) return;

    if (error.message === 'NOT_FOUND') {
      showState('error', {
        title: 'Pokémon not found',
        body: 'Check the spelling or try a National Dex number, such as 25 for Pikachu.'
      });
    } else if (error.message === 'NETWORK_ERROR') {
      showState('error', {
        title: 'Could not reach PokéAPI',
        body: 'Check your internet connection and try again. The site needs PokéAPI to load Pokémon data.'
      });
    } else {
      console.error(error);
      showState('error', {
        title: 'Could not load this Pokémon',
        body: 'PokéAPI returned data we could not process. Please try another Pokémon or try again shortly.'
      });
    }
  }
}

els.form.addEventListener('submit', event => {
  event.preventDefault();
  const query = els.pokemonInput.value.trim();

  if (!query) {
    showState('error', {
      title: 'Enter a Pokémon first',
      body: 'Type a Pokémon name or National Dex number, then press “Check Pokémon”.'
    });
    els.pokemonInput.focus();
    return;
  }

  loadPokemon(query);
});

els.levelInput.addEventListener('input', () => {
  if (currentResult) renderAll(currentResult);
});

document.querySelectorAll('.quick-pick').forEach(button => {
  button.addEventListener('click', () => {
    els.pokemonInput.value = button.dataset.pokemon;
    loadPokemon(button.dataset.pokemon);
  });
});
