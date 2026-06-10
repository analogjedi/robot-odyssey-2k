// Campaign data. Map legend:
//   #  wall            .  floor          P  player spawn
//   1-3 robots         a-d pressure plates
//   A-D blast doors (open per `doors` rules, default: matching plate)
//   K  keycard door    t  service vent (robots only)
//   ~  EMP field (humans only — fries robot logic)
//   X  exit lift
// Items (crystals, keycards) are placed via the `items` list so they can sit
// on any walkable tile, including vents.

export const LEVELS = [
  {
    name: 'SECTOR 01 · BOOT BAY',
    intro: `You wake up on sub-level 5 of the <b>Helios Semiconductor megafab</b>, sealed in
      during an emergency lockdown. The only way out is up — and every blast door
      answers to the fab's automation, not to you.<br><br>
      A maintenance humanoid, <b>AXIOM</b>, idles nearby. Its circuit board is blank.
      Walk onto it and press <b>E</b> to climb inside, then drag a wire from the
      <b>BAT</b>tery's output pin to the <b>THR·E</b> thruster's input pin. Step out
      and AXIOM will drive east down the service vent — straight onto the door plate.`,
    objective: 'Program AXIOM to press the plate beyond the vent, then reach the exit lift.',
    hints: [
      'Walk onto AXIOM and press E to open its circuit board.',
      'Drag from the BAT output pin (right side of the battery) to the input pin of THR·E.',
      'Robots fit through the hatched service vents; humans don\'t. Exit the board with ESC and watch it go.',
      'When the plate is pressed, blast door A opens. Step through to the exit pad.',
    ],
    crystals: 0,
    doors: { A: ['a'] },
    items: [],
    map: [
      '##############################',
      '#............#...............#',
      '#..P.........#.......X.......#',
      '#............#...............#',
      '#............#...............#',
      '#............A...............#',
      '#............#...............#',
      '#............#################',
      '#............#################',
      '#......#######################',
      '#..1...ttttttttttttttttttttta#',
      '#......#######################',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '##############################',
    ],
  },

  {
    name: 'SECTOR 02 · LOGIC FOUNDRY',
    intro: `The foundry floor. Blast door A is interlocked: it needs plates <b>a</b> AND
      <b>b</b> pressed at the same time — a hardware AND gate, fab-style.<br><br>
      Two robots, two vents, two plates. Each vent runs east and then turns.
      A constant thruster only flies straight… but a <b>bumper</b> can vote too:
      wire <b>BAT → THR·E</b> and <b>BMP·E → THR·N</b> and the robot hugs the wall
      around the corner. Mirror it (THR·S) for the south vent.`,
    objective: 'Park AXIOM on plate a and VECTOR on plate b, grab the crystal, take the lift.',
    hints: [
      'Door A needs BOTH plates — that is an AND interlock.',
      'North vent: BAT→THR·E plus BMP·E→THR·N. The robot drives east, hits the wall, then slides north onto plate a.',
      'South vent (VECTOR): BAT→THR·E plus BMP·E→THR·S.',
      'An input pin can take several wires — it reads the OR of them.',
    ],
    crystals: 1,
    doors: { A: ['a', 'b'] },
    items: [{ type: 'crystal', x: 24, y: 3 }],
    unlockChip: 'REFLEX',
    map: [
      '##############################',
      '#............#####a#.........#',
      '#............#####t#.........#',
      '#...1........tttttt#.........#',
      '#............#######.........#',
      '#............#######.........#',
      '#............#######.........#',
      '#............#######.........#',
      '#...P..............A....X....#',
      '#............#######.........#',
      '#............#######.........#',
      '#............#######.........#',
      '#............#######.........#',
      '#...2........tttttt#.........#',
      '#............#####t#.........#',
      '#............#####b#.........#',
      '#............#######.........#',
      '##############################',
    ],
  },

  {
    name: 'SECTOR 03 · CLEANROOM LOOP',
    intro: `A sealed cleanroom conveyor loop, too tight for a human in a bunny suit.
      Somewhere on the far side: the <b>keycard</b> for the gold security door.<br><br>
      PULSE must drive the loop and come back. That needs <b>memory</b>: an SR
      <b>flip-flop</b>. Going out: thrust east. At the far end it drops through a gap;
      hitting the floor (<b>BMP·S</b>) should SET the flip-flop, and Q should drive
      <b>THR·W</b> for the return leg, with Q̄ driving THR·E. Keep the <b>GRAB</b>ber
      on the whole way (BAT→ON) and it will scoop the keycard automatically.
      Touch the returning robot to take the card.`,
    objective: 'Send PULSE around the loop to fetch the keycard, then loot the vault and exit.',
    hints: [
      'Wire: FLIP outputs — Q̄→THR·E (robot starts heading east), Q→THR·W (comes home).',
      'Wire: BMP·E→THR·S so it drops through the gap at the far end, and BMP·S→FLIP S-input to flip direction after the drop.',
      'Wire BAT→GRAB·ON so the claw is always closed; it grabs the keycard as it passes over.',
      'When PULSE returns, walk into it — the keycard transfers to you. The gold K door opens on touch.',
    ],
    crystals: 2,
    doors: {},
    items: [
      { type: 'keycard', x: 27, y: 4 },
      { type: 'crystal', x: 20, y: 8 },
      { type: 'crystal', x: 24, y: 12 },
    ],
    unlockChip: 'OSC',
    map: [
      '##############################',
      '#..........###################',
      '#...3......ttttttttttttttttt##',
      '#..........################t##',
      '#..........ttttttttttttttttt##',
      '#..........###################',
      '#..........#.................#',
      '#..........#.................#',
      '#..P.......#.................#',
      '#..........#.................#',
      '#..........K.................#',
      '#..........#.................#',
      '#..........#.................#',
      '#..........#.................#',
      '#..........#.............X...#',
      '#..........#.................#',
      '#..........#.................#',
      '##############################',
    ],
  },

  {
    name: 'SECTOR 04 · AI WING',
    intro: `The AI research wing. VECTOR here carries a full <b>sensor-fusion scanner</b> —
      camera plus lidar, just like a modern humanoid robot. Its four outputs point
      toward whatever it tracks. Right now it tracks <b>you</b>.<br><br>
      Wire each scanner direction to the matching thruster
      (<b>SCAN·E→THR·E</b>, and so on for N/S/W) and VECTOR becomes a follower —
      a tiny policy network mapping perception to action. Lead it down the vent
      that parallels your corridor until it lands on the plate. Note the shimmering
      <b>EMP field</b>: you can walk through, robots cannot.`,
    objective: 'Teach VECTOR to follow you, lead it onto plate a, collect the crystal, exit east.',
    hints: [
      'Wire all four: SCAN·N→THR·N, SCAN·E→THR·E, SCAN·S→THR·S, SCAN·W→THR·W.',
      'VECTOR is penned behind an EMP field — program it, walk out through the field, then head north and east.',
      'Walk east along the upper corridor, ahead of the robot. It mirrors you inside the vent below.',
      'Stay east of the plate and VECTOR stays pinned on it, holding door A open. Try the NPU part if you want a smarter follower.',
    ],
    crystals: 1,
    doors: { A: ['a'] },
    items: [{ type: 'crystal', x: 20, y: 3 }],
    map: [
      '##############################',
      '##############################',
      '#........................#...#',
      '#........................A.X.#',
      '#........................#...#',
      '#....#####################...#',
      '#....~.2.ttttttttttttttta#...#',
      '#....#####################...#',
      '#........................#...#',
      '#........................#...#',
      '#..P.....................#...#',
      '#........................#...#',
      '#........................#...#',
      '#........................#...#',
      '#........................#...#',
      '#........................#...#',
      '#........................#...#',
      '##############################',
    ],
  },

  {
    name: 'SECTOR 05 · TAPEOUT',
    intro: `The surface lift. Final interlock: door <b>B</b> opens on plate <b>a</b>;
      door <b>A</b> needs plates <b>a</b> AND <b>b</b>. A two-stage pipeline —
      AXIOM must seize plate a so VECTOR can pass door B and take plate b.<br><br>
      Everything you have learned ships here: corner-hugging bumper logic for AXIOM,
      patient straight-line thrust for VECTOR (it will wait at door B and roll on when
      it opens). Antennas are aboard if you want the robots to coordinate by radio —
      and your burned chips work in any robot. Tape out and go home.`,
    objective: 'Sequence both robots onto their plates, collect 3 crystals, ride the lift to the surface.',
    hints: [
      'AXIOM (top vent): BAT→THR·E and BMP·E→THR·N, exactly like the Logic Foundry.',
      'VECTOR (bottom vent): just BAT→THR·E. It parks against door B and continues automatically when AXIOM opens it.',
      'One crystal sits in the center corridor; two more wait in the exit hall behind door A.',
      'If you burned a REFLEX or custom chip earlier, place it from the palette — chips work in every robot.',
    ],
    crystals: 3,
    doors: { A: ['a', 'b'], B: ['a'] },
    items: [
      { type: 'crystal', x: 15, y: 8 },
      { type: 'crystal', x: 24, y: 5 },
      { type: 'crystal', x: 24, y: 10 },
    ],
    map: [
      '##############################',
      '#..........#######a#.........#',
      '#..........#######t#.........#',
      '#...1......tttttttt#.........#',
      '#..........#########.........#',
      '#..........#########.........#',
      '#..........#########.........#',
      '#..........#########.........#',
      '#...P..............A......X..#',
      '#..........#########.........#',
      '#..........#########.........#',
      '#..........#########.........#',
      '#..........###################',
      '#...2......ttttttttBtttttttb##',
      '#..........###################',
      '#..........###################',
      '#..........###################',
      '##############################',
    ],
  },
];

export const SANDBOX = {
  name: 'INNOVATION LAB · SANDBOX',
  sandbox: true,
  intro: `The fab's R&D playground. Three robots, a door, a plate, a vent, no objectives.
    Build oscillators, burn chips, make the robots chase each other by radio —
    this is your breadboard. Press M to return to the menu.`,
  objective: 'No objective — experiment freely.',
  hints: [
    'Try a ring oscillator: wire a NOT gate\'s output back to its own input.',
    'Wire CLK→TX on one robot and RX→THR·E on another (same channel) for remote control.',
    'Place PIN▸ and ▸PIN pads around some logic and press BURN CHIP to fabricate your own IC.',
  ],
  crystals: 0,
  doors: { A: ['a'] },
  items: [{ type: 'crystal', x: 22, y: 3 }, { type: 'keycard', x: 22, y: 12 }],
  map: [
    '##############################',
    '#............................#',
    '#.P..........................#',
    '#...1........................#',
    '#..............#.............#',
    '#..............#.............#',
    '#..............#.............#',
    '#..............#.............#',
    '#...2..........A.............#',
    '#..............#.............#',
    '#..............#.............#',
    '#..............#.............#',
    '#..............#.............#',
    '#...3..........#.............#',
    '#....a.......................#',
    '#............................#',
    '#............ttttt...........#',
    '##############################',
  ],
};
