/**
 * Unit Lens — unit database.
 * Loaded first; exposes `self.UL` namespace shared by the other content scripts.
 *
 * Base units per category:
 *   length m | area m2 | volume L | mass kg | temperature C (affine)
 *   speed m/s | pressure kPa | energy kJ | power kW | torque N*m
 *   economy L/100km (inverse!)
 */
(function () {
  'use strict';

  const UL = (self.UL = self.UL || {});

  /** Measurement systems a unit can belong to. */
  const METRIC = 'metric';
  const US = 'us';
  const UK = 'uk'; // imperial
  const ANY = 'any'; // system-neutral (e.g. knots, kelvin) — never flagged as foreign

  /**
   * u() builds a unit record.
   * @param id        stable id
   * @param cat       category key
   * @param systems   array of systems this unit is "native" to
   * @param factor    multiply value by this to get the category base unit
   * @param symbol    canonical short form used when rendering output
   * @param names     match tokens (lowercased unless listed in `cs`)
   * @param opts      { cs: case-sensitive tokens, risky: needs strict context, offset }
   */
  function u(id, cat, systems, factor, symbol, names, opts) {
    return Object.assign(
      { id, cat, systems, factor, symbol, names, cs: [], risky: false },
      opts || {}
    );
  }

  UL.SYSTEMS = { METRIC, US, UK, ANY };

  UL.CATEGORIES = {
    length: { base: 'm', label: 'Length & distance' },
    area: { base: 'm²', label: 'Area' },
    volume: { base: 'L', label: 'Volume & liquids' },
    mass: { base: 'kg', label: 'Weight & mass' },
    temperature: { base: '°C', label: 'Temperature' },
    speed: { base: 'm/s', label: 'Speed' },
    pressure: { base: 'kPa', label: 'Pressure' },
    energy: { base: 'kJ', label: 'Energy' },
    power: { base: 'kW', label: 'Power' },
    torque: { base: 'N·m', label: 'Torque' },
    economy: { base: 'L/100km', label: 'Fuel economy' }
  };

  UL.UNITS = [];
  const add = (...list) => UL.UNITS.push(...list);

  /* ------------------------------------------------------------------ length */
  add(
    u('nm', 'length', [METRIC], 1e-9, 'nm', ['nm', 'nanometer', 'nanometers', 'nanometre', 'nanometres']),
    u('um', 'length', [METRIC], 1e-6, 'µm', ['µm', 'um', 'micron', 'microns', 'micrometer', 'micrometers', 'micrometre', 'micrometres']),
    u('mm', 'length', [METRIC], 1e-3, 'mm', ['mm', 'millimeter', 'millimeters', 'millimetre', 'millimetres']),
    u('cm', 'length', [METRIC], 1e-2, 'cm', ['cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres']),
    u('dm', 'length', [METRIC], 1e-1, 'dm', ['dm', 'decimeter', 'decimeters', 'decimetre', 'decimetres']),
    u('m', 'length', [METRIC], 1, 'm', ['meter', 'meters', 'metre', 'metres'], { cs: ['m'] }),
    u('km', 'length', [METRIC], 1e3, 'km', ['km', 'kms', 'kilometer', 'kilometers', 'kilometre', 'kilometres', 'klick', 'klicks']),
    u('mil', 'length', [US], 2.54e-5, 'mil', ['mil', 'mils', 'thou']),
    u('in', 'length', [US, UK], 0.0254, 'in', ['inch', 'inches'], { risky: true, cs: ['in', 'ins', '"', '″', "''"] }),
    u('ft', 'length', [US, UK], 0.3048, 'ft', ['ft', 'foot', 'feet', "'", '′'], { risky: false }),
    u('yd', 'length', [US, UK], 0.9144, 'yd', ['yd', 'yds', 'yard', 'yards']),
    u('fathom', 'length', [US, UK], 1.8288, 'fathom', ['fathom', 'fathoms']),
    u('rod', 'length', [US, UK], 5.0292, 'rod', ['rod', 'rods', 'perch']),
    u('chain', 'length', [US, UK], 20.1168, 'chain', ['chain', 'chains']),
    u('furlong', 'length', [US, UK], 201.168, 'furlong', ['furlong', 'furlongs']),
    u('mi', 'length', [US, UK], 1609.344, 'mi', ['mi', 'mile', 'miles']),
    // Specialist units: foreign to every reader, so always worth converting.
    u('nmi', 'length', [], 1852, 'nmi', ['nmi', 'nautical mile', 'nautical miles', 'sea mile', 'sea miles']),
    u('league', 'length', [US, UK], 4828.032, 'league', ['league', 'leagues']),
    u('au', 'length', [ANY], 1.495978707e11, 'AU', ['au', 'astronomical unit', 'astronomical units']),
    u('ly', 'length', [ANY], 9.4607304725808e15, 'ly', ['ly', 'light year', 'light years', 'light-year', 'light-years']),
    u('pc', 'length', [ANY], 3.0856775814913673e16, 'pc', ['parsec', 'parsecs']),
    u('hand', 'length', [US, UK], 0.1016, 'hands', ['hand', 'hands']),
    u('smoot', 'length', [ANY], 1.70180, 'smoots', ['smoot', 'smoots'])
  );

  /* -------------------------------------------------------------------- area */
  add(
    u('mm2', 'area', [METRIC], 1e-6, 'mm²', ['mm2', 'mm²', 'sq mm', 'square mm', 'square millimeter', 'square millimeters', 'square millimetre', 'square millimetres']),
    u('cm2', 'area', [METRIC], 1e-4, 'cm²', ['cm2', 'cm²', 'sq cm', 'square cm', 'square centimeter', 'square centimeters', 'square centimetre', 'square centimetres']),
    u('m2', 'area', [METRIC], 1, 'm²', ['m2', 'm²', 'sqm', 'sq m', 'sq. m', 'square m', 'square meter', 'square meters', 'square metre', 'square metres']),
    u('ha', 'area', [METRIC], 1e4, 'ha', ['ha', 'hectare', 'hectares']),
    u('km2', 'area', [METRIC], 1e6, 'km²', ['km2', 'km²', 'sq km', 'square km', 'square kilometer', 'square kilometers', 'square kilometre', 'square kilometres']),
    u('in2', 'area', [US, UK], 6.4516e-4, 'in²', ['in2', 'in²', 'sq in', 'sq. in', 'square inch', 'square inches']),
    u('ft2', 'area', [US, UK], 0.09290304, 'ft²', ['ft2', 'ft²', 'sqft', 'sq ft', 'sq. ft', 'square ft', 'square foot', 'square feet']),
    u('yd2', 'area', [US, UK], 0.83612736, 'yd²', ['yd2', 'yd²', 'sq yd', 'sq. yd', 'square yard', 'square yards']),
    u('acre', 'area', [US, UK], 4046.8564224, 'acres', ['acre', 'acres']),
    u('mi2', 'area', [US, UK], 2589988.110336, 'mi²', ['mi2', 'mi²', 'sq mi', 'sq. mi', 'square mile', 'square miles'])
  );

  /* ------------------------------------------------------------------ volume */
  // base: litre. US and imperial liquid units differ ~20% — kept separate.
  add(
    u('ml', 'volume', [METRIC], 1e-3, 'mL', ['ml', 'mls', 'millilitre', 'millilitres', 'milliliter', 'milliliters', 'cc', 'ccs', 'cm3', 'cm³', 'cubic centimeter', 'cubic centimeters', 'cubic centimetre', 'cubic centimetres']),
    u('cl', 'volume', [METRIC], 1e-2, 'cL', ['cl', 'centilitre', 'centilitres', 'centiliter', 'centiliters']),
    u('dl', 'volume', [METRIC], 1e-1, 'dL', ['dl', 'decilitre', 'decilitres', 'deciliter', 'deciliters']),
    u('l', 'volume', [METRIC], 1, 'L', ['litre', 'litres', 'liter', 'liters', 'ltr', 'ltrs'], { cs: ['L'] }),
    u('m3', 'volume', [METRIC], 1e3, 'm³', ['m3', 'm³', 'cubic meter', 'cubic meters', 'cubic metre', 'cubic metres', 'cbm']),
    u('kl', 'volume', [METRIC], 1e3, 'kL', ['kl', 'kilolitre', 'kilolitres', 'kiloliter', 'kiloliters']),

    u('tsp', 'volume', [US], 4.92892159375e-3, 'tsp', ['tsp', 'tsps', 'teaspoon', 'teaspoons']),
    u('tbsp', 'volume', [US], 14.78676478125e-3, 'tbsp', ['tbsp', 'tbsps', 'tblsp', 'tablespoon', 'tablespoons']),
    u('floz', 'volume', [US], 29.5735295625e-3, 'fl oz', ['fl oz', 'fl. oz', 'fl.oz', 'floz', 'fluid ounce', 'fluid ounces', 'us fl oz']),
    u('cup', 'volume', [US], 236.5882365e-3, 'cups', ['cup', 'cups']),
    u('pt', 'volume', [US], 473.176473e-3, 'pt', ['pint', 'pints', 'us pint', 'us pints'], { cs: ['pt', 'pts'] }),
    u('qt', 'volume', [US], 946.352946e-3, 'qt', ['qt', 'qts', 'quart', 'quarts']),
    u('gal', 'volume', [US], 3.785411784, 'gal', ['gal', 'gals', 'gallon', 'gallons', 'us gal', 'us gallon', 'us gallons']),
    u('bbl', 'volume', [US], 158.987294928, 'bbl', ['bbl', 'bbls', 'barrel', 'barrels']),
    u('ft3', 'volume', [US, UK], 28.316846592, 'ft³', ['ft3', 'ft³', 'cu ft', 'cu. ft', 'cubic foot', 'cubic feet', 'cuft']),
    u('in3', 'volume', [US, UK], 16.387064e-3, 'in³', ['in3', 'in³', 'cu in', 'cu. in', 'cubic inch', 'cubic inches']),
    u('yd3', 'volume', [US, UK], 764.554857984, 'yd³', ['yd3', 'yd³', 'cu yd', 'cubic yard', 'cubic yards']),

    u('floz_uk', 'volume', [UK], 28.4130625e-3, 'fl oz', ['imp fl oz', 'imperial fluid ounce', 'imperial fluid ounces']),
    u('pt_uk', 'volume', [UK], 568.26125e-3, 'pt', ['imperial pint', 'imperial pints', 'imp pint', 'imp pints']),
    u('qt_uk', 'volume', [UK], 1136.5225e-3, 'qt', ['imperial quart', 'imperial quarts']),
    u('gal_uk', 'volume', [UK], 4.54609, 'gal', ['imperial gallon', 'imperial gallons', 'imp gal', 'imp gallon', 'imp gallons'])
  );

  /* -------------------------------------------------------------------- mass */
  add(
    u('mg', 'mass', [METRIC], 1e-6, 'mg', ['mg', 'milligram', 'milligrams', 'milligramme', 'milligrammes']),
    u('g', 'mass', [METRIC], 1e-3, 'g', ['gram', 'grams', 'gramme', 'grammes'], { cs: ['g'] }),
    u('kg', 'mass', [METRIC], 1, 'kg', ['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms', 'kilogramme', 'kilogrammes']),
    u('tonne', 'mass', [METRIC], 1e3, 't', ['tonne', 'tonnes', 'metric ton', 'metric tons', 'metric tonne', 'metric tonnes']),
    u('gr', 'mass', [US, UK], 6.479891e-5, 'gr', ['grain', 'grains']),
    u('oz', 'mass', [US, UK], 0.028349523125, 'oz', ['oz', 'ozs', 'ounce', 'ounces']),
    u('lb', 'mass', [US, UK], 0.45359237, 'lb', ['lb', 'lbs', 'pound', 'pounds', '#']),
    u('st', 'mass', [UK], 6.35029318, 'st', ['stone', 'stones'], { cs: ['st'] }),
    u('ton_us', 'mass', [US], 907.18474, 'tons', ['short ton', 'short tons', 'us ton', 'us tons']),
    u('ton_uk', 'mass', [UK], 1016.0469088, 'tons', ['long ton', 'long tons', 'imperial ton', 'imperial tons']),
    u('ton', 'mass', [US, UK], 907.18474, 'tons', ['ton', 'tons'], { risky: true }),
    u('ct', 'mass', [ANY], 2e-4, 'ct', ['carat', 'carats'], { cs: ['ct'] })
  );

  /* ------------------------------------------------------------- temperature */
  // affine: base(°C) = value * factor + offset
  add(
    u('c', 'temperature', [METRIC, UK], 1, '°C', ['°c', 'celsius', 'centigrade', 'degrees celsius', 'deg c', 'degrees c'], { offset: 0, cs: ['C', '℃'] }),
    u('f', 'temperature', [US], 5 / 9, '°F', ['°f', 'fahrenheit', 'degrees fahrenheit', 'deg f', 'degrees f'], { offset: -160 / 9, cs: ['F', '℉'] }),
    u('k', 'temperature', [ANY], 1, 'K', ['kelvin', 'kelvins'], { offset: -273.15, cs: ['K'] }),
    u('r', 'temperature', [ANY], 5 / 9, '°R', ['°r', 'rankine', 'degrees rankine'], { offset: -273.15 })
  );

  /* ------------------------------------------------------------------- speed */
  add(
    u('mps', 'speed', [METRIC], 1, 'm/s', ['m/s', 'mps', 'meters per second', 'metres per second', 'meter per second']),
    u('kmh', 'speed', [METRIC], 1 / 3.6, 'km/h', ['km/h', 'kmh', 'kph', 'km/hr', 'kilometers per hour', 'kilometres per hour', 'km per hour']),
    u('mph', 'speed', [US, UK], 0.44704, 'mph', ['mph', 'mi/h', 'miles per hour', 'miles an hour', 'miles/hour']),
    u('fps', 'speed', [US, UK], 0.3048, 'ft/s', ['ft/s', 'fps', 'feet per second', 'foot per second', 'ft/sec']),
    u('kn', 'speed', [], 0.514444, 'kn', ['kn', 'kt', 'kts', 'knot', 'knots']),
    u('mach', 'speed', [ANY], 340.29, 'Mach', ['mach'])
  );

  /* ---------------------------------------------------------------- pressure */
  add(
    u('pa', 'pressure', [METRIC], 1e-3, 'Pa', ['pa', 'pascal', 'pascals']),
    u('hpa', 'pressure', [METRIC], 0.1, 'hPa', ['hpa', 'hectopascal', 'hectopascals', 'mbar', 'millibar', 'millibars']),
    u('kpa', 'pressure', [METRIC], 1, 'kPa', ['kpa', 'kilopascal', 'kilopascals']),
    u('mpa', 'pressure', [METRIC], 1e3, 'MPa', ['mpa', 'megapascal', 'megapascals']),
    u('bar', 'pressure', [METRIC], 100, 'bar', ['bar', 'bars']),
    u('psi', 'pressure', [US, UK], 6.894757, 'psi', ['psi', 'psig', 'pounds per square inch', 'lb/in2', 'lbf/in2']),
    u('atm', 'pressure', [ANY], 101.325, 'atm', ['atm', 'atmosphere', 'atmospheres']),
    u('mmhg', 'pressure', [ANY], 0.1333224, 'mmHg', ['mmhg', 'torr', 'millimeters of mercury']),
    u('inhg', 'pressure', [US], 3.386389, 'inHg', ['inhg', 'in hg', 'inches of mercury', '"hg'])
  );

  /* ------------------------------------------------------------------ energy */
  add(
    u('j', 'energy', [METRIC], 1e-3, 'J', ['joule', 'joules'], { cs: ['J'] }),
    u('kj', 'energy', [METRIC], 1, 'kJ', ['kj', 'kilojoule', 'kilojoules']),
    u('mj', 'energy', [METRIC], 1e3, 'MJ', ['mj', 'megajoule', 'megajoules']),
    u('cal', 'energy', [ANY], 4.184e-3, 'cal', ['cal', 'cals', 'calorie', 'calories'], { risky: true }),
    u('kcal', 'energy', [ANY], 4.184, 'kcal', ['kcal', 'kcals', 'kilocalorie', 'kilocalories', 'food calorie', 'food calories'], { cs: ['Cal', 'Cals'] }),
    u('wh', 'energy', [METRIC], 3.6, 'Wh', ['wh', 'watt hour', 'watt hours', 'watt-hour', 'watt-hours']),
    u('kwh', 'energy', [METRIC], 3600, 'kWh', ['kwh', 'kilowatt hour', 'kilowatt hours', 'kilowatt-hour', 'kilowatt-hours']),
    u('btu', 'energy', [US, UK], 1.05505585262, 'BTU', ['btu', 'btus', 'british thermal unit', 'british thermal units']),
    u('ftlb_e', 'energy', [US, UK], 1.3558179483314e-3, 'ft·lb', ['foot-pound', 'foot-pounds'])
  );

  /* ------------------------------------------------------------------- power */
  add(
    u('w', 'power', [METRIC], 1e-3, 'W', ['watt', 'watts'], { cs: ['W'] }),
    u('kw', 'power', [METRIC], 1, 'kW', ['kw', 'kilowatt', 'kilowatts']),
    u('mw', 'power', [METRIC], 1e3, 'MW', ['mw', 'megawatt', 'megawatts']),
    u('hp', 'power', [US, UK], 0.745699872, 'hp', ['hp', 'bhp', 'horsepower', 'horse power']),
    u('ps', 'power', [METRIC], 0.73549875, 'PS', ['ps', 'pferdestärke', 'metric horsepower']),
    u('btuh', 'power', [US], 2.930711e-4, 'BTU/h', ['btu/h', 'btu/hr', 'btuh']),
    u('tonref', 'power', [US], 3.5168528, 'ton', ['ton of refrigeration', 'tons of refrigeration'])
  );

  /* ------------------------------------------------------------------ torque */
  add(
    u('nm_t', 'torque', [METRIC], 1, 'N·m', ['nm', 'n·m', 'n-m', 'newton meter', 'newton meters', 'newton metre', 'newton metres', 'newton-meter', 'newton-metres']),
    u('lbft', 'torque', [US, UK], 1.3558179483314, 'lb·ft', ['lb-ft', 'lb·ft', 'lbft', 'ft-lb', 'ft·lb', 'ftlb', 'ft lbs', 'ft-lbs', 'lb-ft', 'pound-feet', 'pound feet', 'foot pounds']),
    u('lbin', 'torque', [US, UK], 0.1129848290276, 'lb·in', ['lb-in', 'in-lb', 'inch-pound', 'inch-pounds', 'in-lbs']),
    u('kgfm', 'torque', [METRIC], 9.80665, 'kgf·m', ['kgf-m', 'kgf·m', 'kg-m', 'kgm'])
  );

  /* ----------------------------------------------------------- fuel economy */
  // inverse: base (L/100km) = inverse / value
  add(
    u('l100km', 'economy', [METRIC], 1, 'L/100km', ['l/100km', 'l/100 km', 'litres per 100 km', 'liters per 100 km', 'l per 100km']),
    u('kmpl', 'economy', [METRIC], 0, 'km/L', ['km/l', 'kmpl', 'km per litre', 'km per liter', 'kilometers per liter'], { inverse: 100 }),
    u('mpg', 'economy', [US], 0, 'mpg', ['mpg', 'miles per gallon', 'mi/gal'], { inverse: 235.214583 }),
    u('mpg_uk', 'economy', [UK], 0, 'mpg', ['imperial mpg', 'mpg (imp)', 'uk mpg'], { inverse: 282.4809363 })
  );

  /* ------------------------------------------------------- indexes & helpers */

  UL.BY_ID = Object.create(null);
  for (const unit of UL.UNITS) UL.BY_ID[unit.id] = unit;

  /** token (lowercased, or exact for case-sensitive) -> unit */
  UL.BY_TOKEN = Object.create(null);
  UL.BY_TOKEN_CS = Object.create(null);
  for (const unit of UL.UNITS) {
    for (const n of unit.names) {
      if (!(n in UL.BY_TOKEN)) UL.BY_TOKEN[n] = unit;
    }
    for (const n of unit.cs) {
      if (!(n in UL.BY_TOKEN_CS)) UL.BY_TOKEN_CS[n] = unit;
    }
  }

  /** Value in `unit` -> value in the category's base unit. */
  UL.toBase = function (unit, value) {
    if (unit.inverse) return unit.inverse / value;
    if (unit.cat === 'temperature') return value * unit.factor + (unit.offset || 0);
    return value * unit.factor;
  };

  /** Value in the category's base unit -> value in `unit`. */
  UL.fromBase = function (unit, base) {
    if (unit.inverse) return unit.inverse / base;
    if (unit.cat === 'temperature') return (base - (unit.offset || 0)) / unit.factor;
    return base / unit.factor;
  };

  /** True when `unit` is not something a user of `system` reads natively. */
  UL.isForeign = function (unit, system) {
    if (unit.systems.includes(ANY)) return false;
    return !unit.systems.includes(system);
  };

  /**
   * Target ladders: pick the output unit by magnitude (in base units).
   * Each entry is [unitId, exclusiveUpperBoundInBaseUnits].
   */
  UL.LADDERS = {
    length: {
      metric: [['mm', 0.01], ['cm', 1], ['m', 1000], ['km', Infinity]],
      us: [['in', 0.3048], ['ft', 914.4], ['mi', Infinity]],
      uk: [['in', 0.3048], ['ft', 914.4], ['mi', Infinity]]
    },
    area: {
      metric: [['mm2', 1e-4], ['cm2', 1], ['m2', 1e4], ['ha', 1e6], ['km2', Infinity]],
      us: [['in2', 0.09290304], ['ft2', 4046.86], ['acre', 2589988], ['mi2', Infinity]],
      uk: [['in2', 0.09290304], ['ft2', 4046.86], ['acre', 2589988], ['mi2', Infinity]]
    },
    volume: {
      metric: [['ml', 1], ['l', 1000], ['m3', Infinity]],
      us: [['floz', 2.0], ['qt', 3.7854], ['gal', Infinity]],
      uk: [['floz_uk', 2.0], ['pt_uk', 4.5461], ['gal_uk', Infinity]]
    },
    mass: {
      metric: [['mg', 1e-3], ['g', 1], ['kg', 1000], ['tonne', Infinity]],
      us: [['oz', 0.45359237], ['lb', 907.18474], ['ton_us', Infinity]],
      uk: [['oz', 0.45359237], ['lb', 25.4], ['st', 1016.05], ['ton_uk', Infinity]]
    },
    temperature: {
      metric: [['c', Infinity]],
      us: [['f', Infinity]],
      uk: [['c', Infinity]]
    },
    speed: {
      metric: [['kmh', Infinity]],
      us: [['mph', Infinity]],
      uk: [['mph', Infinity]]
    },
    pressure: {
      metric: [['kpa', 1000], ['bar', Infinity]],
      us: [['psi', Infinity]],
      uk: [['psi', Infinity]]
    },
    energy: {
      metric: [['kj', 3600], ['kwh', Infinity]],
      us: [['btu', Infinity]],
      uk: [['btu', Infinity]]
    },
    power: {
      metric: [['kw', Infinity]],
      us: [['hp', Infinity]],
      uk: [['hp', Infinity]]
    },
    torque: {
      metric: [['nm_t', Infinity]],
      us: [['lbft', Infinity]],
      uk: [['lbft', Infinity]]
    },
    economy: {
      metric: [['l100km', Infinity]],
      us: [['mpg', Infinity]],
      uk: [['mpg_uk', Infinity]]
    }
  };

  /**
   * The source unit hints at the scale being discussed: feet and inches imply
   * body/building scale (metres read better), miles imply travel distance
   * (kilometres read better). Without this, "14,115 ft" becomes a silly "4.3 km".
   */
  UL.SOURCE_LADDERS = {
    ft: { metric: [['cm', 1], ['m', 10000], ['km', Infinity]] },
    in: { metric: [['mm', 0.01], ['cm', 1], ['m', Infinity]] },
    yd: { metric: [['cm', 1], ['m', 10000], ['km', Infinity]] },
    fathom: { metric: [['m', Infinity]] },
    ft2: { metric: [['cm2', 1], ['m2', Infinity]] },
    in2: { metric: [['mm2', 1e-4], ['cm2', 1], ['m2', Infinity]] }
  };

  /**
   * Source units whose natural counterpart isn't what the ladder would pick
   * (barometric pressure and battery capacity being the classic cases).
   */
  UL.PREFERRED = {
    inhg: { metric: 'hpa' },
    hpa: { us: 'inhg' },
    mmhg: { us: 'inhg' },
    kwh: { us: 'kwh', uk: 'kwh' },
    wh: { us: 'wh', uk: 'wh' },
    btu: { metric: 'kj' },
    cal: { metric: 'kj' },
    // ft/s is used for muzzle velocity and free-fall, where m/s reads better than km/h
    fps: { metric: 'mps' },
    mil: { metric: 'um' },
    gr: { metric: 'mg' }
  };

  /** System presets: which target system to use for each category. */
  UL.PRESETS = {
    metric: {
      label: 'Metric (SI)',
      hint: 'metres, litres, kilograms, °C — most of the world',
      map: fill('metric')
    },
    us: {
      label: 'US customary',
      hint: 'miles, US gallons, pounds, °F',
      map: fill('us')
    },
    uk: {
      label: 'UK / Imperial hybrid',
      hint: 'miles & stone, but °C and litres of fuel',
      map: Object.assign(fill('uk'), {
        temperature: 'metric',
        volume: 'uk',
        area: 'metric',
        energy: 'metric',
        power: 'metric'
      })
    },
    custom: { label: 'Custom', hint: 'pick a system per category', map: fill('metric') }
  };

  function fill(system) {
    const out = {};
    for (const cat of Object.keys(UL.CATEGORIES)) out[cat] = system;
    return out;
  }
})();
