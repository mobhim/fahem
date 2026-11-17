/* Fahem — the ready-made demo decks in English (same scenes as the Arabic ones in lesson.js). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.F = root.F || {}).DEMOS_EN = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const CS = {
    id: 'demo', name: 'Example: Introduction to Data Structures',
    slides: [
      { title: 'What are data structures?', bullets: ['A way to organise data in memory', 'Each structure makes certain operations easy', 'The right choice makes the program faster'] },
      { title: 'The Array', bullets: ['Elements sit next to each other in memory', 'Access by index is O(1)', 'Inserting in the middle costs O(n)'] },
      { title: 'The Stack', bullets: ['Last in, first out (LIFO)', 'Two operations: push and pop', 'Example: the Undo button'] },
      { title: 'The Queue', bullets: ['First in, first out (FIFO)', 'Two operations: enqueue and dequeue', 'Example: the print queue'] },
    ],
    lessons: [
      { title: 'What are data structures?', takeaway: 'The right structure = a faster program',
        scenes: [
          { type: 'map', title: 'Tidying the room', hub: 'Data structures',
            say: 'Picture your room. If your clothes are thrown everywhere, you waste time searching. Data structures are tidying the room, but inside the computer’s memory.',
            items: [
              { icon: 'grid', label: 'Organising memory', detail: 'where each item goes', say: 'First, they are a way of organising: we decide where each piece of data lives and how it connects to its neighbours.' },
              { icon: 'search', label: 'Each has a strength', detail: 'search, insert, delete', say: 'And each structure is good at something. One is fast at searching, another at inserting.' },
              { icon: 'clock', label: 'The choice matters', detail: 'a second or an hour', say: 'That is why your choice matters. The same program can take a second or an hour.' },
            ] },
          { type: 'bars', title: 'Steps to find one item among a thousand', unit: 'steps', approx: true,
            say: 'Look at the difference in numbers. We want one item among a thousand.',
            items: [
              { label: 'Unsorted list', value: 1000, say: 'If the list is unsorted, you may walk through all thousand.' },
              { label: 'Sorted array', value: 10, say: 'If it is sorted, you halve it every time and arrive in about ten steps.' },
              { label: 'Hash table', value: 1, say: 'And with a hash table you arrive in the first step.' },
            ] },
          { type: 'steps', title: 'What we will cover', say: 'Now we will go through three famous structures in order.',
            items: [
              { icon: 'grid', label: 'The array', detail: 'numbered lockers', say: 'We start with the array.' },
              { icon: 'stack', label: 'The stack', detail: 'a pile of plates', say: 'Then the stack.' },
              { icon: 'queue', label: 'The queue', detail: 'the coffee line', say: 'And we finish with the queue.' },
            ] },
        ],
        quiz: [{ q: 'Why do we care which data structure we choose?', options: ['For how the code looks', 'Because it affects how fast operations run', 'Because the language forces us'], answer: 1, why: 'Every structure speeds up some operations and slows down others.' }],
        tf: [{ s: 'One data structure is the best for every operation.', answer: false, why: 'Each structure is strong at some operations and weak at others.' }, { s: 'Data structures decide how information is arranged in memory.', answer: true, why: 'That is their definition: a way of organising data.' }, { s: 'The choice of structure does not affect a program’s speed.', answer: false, why: 'The same program’s running time can change a lot with the structure.' }] },
      { title: 'The Array', takeaway: 'Fast to read, slow to insert in the middle',
        scenes: [
          { type: 'map', title: 'A row of numbered lockers', hub: 'Array',
            say: 'An array is like a row of numbered lockers side by side, each holding one item.',
            items: [
              { icon: 'grid', label: 'Side by side', detail: 'one row in memory', say: 'The elements are adjacent in memory, with no gaps between them.' },
              { icon: 'bolt', label: 'Instant access O(1)', detail: 'jump straight to the index', say: 'Because they are numbered, you go straight to locker five without passing the ones before it.' },
            ] },
          { type: 'line', title: 'The cost of inserting in the middle', unit: 'items shifted', approx: true,
            say: 'But inserting in the middle has a price, and it grows with the size of the array.',
            items: [
              { label: '100 items', value: 50, say: 'In an array of a hundred, you shift about fifty items.' },
              { label: '200', value: 100, say: 'Double the size, double the work.' },
              { label: '300', value: 150, say: 'And it keeps growing.' },
              { label: '400', value: 200, say: 'That is what we call O of n: the cost follows the count.' },
            ] },
          { type: 'big', title: 'The rule', text: 'Read a lot, edit a little', note: 'This is where the array shines', say: 'So the takeaway: use an array when you read a lot and edit a little.' },
        ],
        quiz: [{ q: 'What does reading element number 100 of an array cost?', options: ['O(1)', 'O(n)', 'O(n²)'], answer: 0, why: 'The index takes you straight to the element.' }],
        tf: [{ s: 'Array elements are adjacent in memory.', answer: true, why: 'That is why access by index is fast.' }, { s: 'Inserting in the middle of an array costs O(1).', answer: false, why: 'The elements after it must shift, so it costs O(n).' }, { s: 'An array suits reading a lot and editing a little.', answer: true, why: 'Reading by index is instant and editing in the middle is costly.' }] },
      { title: 'The Stack', takeaway: 'LIFO: last in, first out',
        scenes: [
          { type: 'map', title: 'A pile of plates', hub: 'Stack',
            say: 'A stack is like a pile of plates. You put a plate on top, and you take from the top.',
            items: [
              { icon: 'stack', label: 'LIFO', detail: 'last in, first out', say: 'The rule is called LIFO: the last plate you put down is the first one you take.' },
              { icon: 'in', label: 'push', detail: 'adds an item on top', say: 'Push puts an item on top.' },
              { icon: 'out', label: 'pop', detail: 'removes the top item', say: 'And pop removes the item on top.' },
            ] },
          { type: 'steps', title: 'Try it step by step', say: 'Let us try it with numbers.',
            items: [
              { icon: 'in', label: 'push 1', detail: 'stack: 1', say: 'We put one.' },
              { icon: 'in', label: 'push 2', detail: 'stack: 1, 2', say: 'Two on top of it.' },
              { icon: 'in', label: 'push 3', detail: 'stack: 1, 2, 3', say: 'And three on top.' },
              { icon: 'out', label: 'pop', detail: 'returns 3', say: 'When we pop, three comes out, because it went in last.' },
            ] },
          { type: 'list', title: 'Where do you see it?', say: 'And you meet the stack in things you use every day.',
            items: [
              { icon: 'loop', label: 'The Undo button', detail: 'the last edit is removed first', say: 'The Undo button: the last edit is the first to go.' },
              { icon: 'link', label: 'The browser Back button', detail: 'the last page comes back first', say: 'And the browser’s Back button is the same idea.' },
            ] },
        ],
        quiz: [{ q: 'We push 1, then 2, then 3. What does pop return?', options: ['1', '2', '3'], answer: 2, why: 'The last item in (3) is the first out.' }],
        tf: [{ s: 'A stack returns the oldest item that went in.', answer: false, why: 'A stack is LIFO: it returns the newest item.' }, { s: 'Push adds an item on top of the stack.', answer: true, why: 'Adding and removing both happen at the top.' }, { s: 'The Undo button is an example of a stack.', answer: true, why: 'The last edit is the first one removed.' }] },
      { title: 'The Queue', takeaway: 'FIFO: first in, first out',
        scenes: [
          { type: 'steps', title: 'The coffee line', say: 'A queue is like the line at a coffee shop. Whoever came first is served first.',
            items: [
              { icon: 'in', label: 'enqueue', detail: 'you join at the back', say: 'Enqueue: you join at the back of the line.' },
              { icon: 'clock', label: 'Wait your turn', detail: 'those ahead are served', say: 'You wait until those ahead of you are done.' },
              { icon: 'out', label: 'dequeue', detail: 'you leave from the front', say: 'And dequeue: you leave from the front when it is your turn.' },
            ] },
          { type: 'compare', title: 'Stack or queue?', a: 'Stack', b: 'Queue', say: 'The difference from a stack is small but important.',
            items: [
              { side: 'a', label: 'LIFO', detail: 'returns the newest', say: 'A stack returns the last one in.' },
              { side: 'b', label: 'FIFO', detail: 'returns the oldest', say: 'And a queue returns the first one in.' },
              { side: 'a', label: 'One end', detail: 'in and out at the top', say: 'A stack works from one end.' },
              { side: 'b', label: 'Two ends', detail: 'in at the back, out at the front', say: 'And a queue from two ends.' },
            ] },
          { type: 'cycle', title: 'The print queue', say: 'Its practical example is the print queue, which runs in the same order all day.',
            items: [
              { label: 'You send a file', say: 'You send your file.' },
              { label: 'It joins the queue', say: 'It joins the back of the queue.' },
              { label: 'Oldest is printed', say: 'The printer takes the oldest file.' },
              { label: 'It leaves the queue', say: 'It leaves, and the next one’s turn comes.' },
            ] },
        ],
        quiz: [{ q: 'What is the difference between a stack and a queue?', options: ['A stack is LIFO and a queue is FIFO', 'A queue is always faster', 'There is no difference'], answer: 0, why: 'A stack returns the newest, a queue the oldest.' }],
        tf: [{ s: 'A queue follows the FIFO rule.', answer: true, why: 'First in, first out.' }, { s: 'Dequeue adds an item at the back of the queue.', answer: false, why: 'Dequeue removes from the front; adding is called enqueue.' }, { s: 'In a print queue, the last file you sent prints first.', answer: false, why: 'The file sent first prints first.' }] },
    ],
  };

  const PHARMA = {
    id: 'demo-pharma', name: 'Pharmacy example: Paracetamol', note: 'Simplified teaching content, not medical advice.',
    slides: [
      { title: 'Paracetamol: mechanism of action', bullets: ['Pain reliever and fever reducer', 'Inhibits COX enzymes in the central nervous system', 'Weak anti-inflammatory effect'] },
      { title: 'Pharmacokinetics and safety', bullets: ['Absorbed quickly after swallowing', 'Metabolised in the liver', 'Overdose harms the liver'] },
    ],
    lessons: [
      { title: 'Paracetamol: mechanism of action', takeaway: 'It lowers prostaglandins in the brain, so pain eases and fever drops',
        scenes: [
          { type: 'lab', title: 'From tablet to blood', say: 'Let us follow the tablet as if we were in the lab. You swallow it, and the work begins.',
            items: [
              { vessel: 'pill', label: 'The tablet', detail: 'a dose taken by mouth', say: 'We start with the tablet itself, taken by mouth.' },
              { vessel: 'beaker', label: 'Stomach and gut', detail: 'dissolves and is absorbed', say: 'It dissolves and is absorbed from the gut quickly.' },
              { vessel: 'tube', label: 'The blood', detail: 'carried around the body', say: 'It enters the blood and travels around the body.' },
              { vessel: 'flask', label: 'The brain', detail: 'where it mainly acts', say: 'And it reaches the brain, where it does most of its work.' },
            ] },
          { type: 'steps', title: 'What does it do in the brain?', say: 'So what exactly happens there?',
            items: [
              { icon: 'warn', label: 'Injury or fever', detail: 'the body sends a signal', say: 'When there is pain or fever, the body calls for substances named prostaglandins.' },
              { icon: 'loop', label: 'COX enzyme', detail: 'makes prostaglandins', say: 'What makes them is an enzyme called COX.' },
              { icon: 'check', label: 'The drug inhibits it', detail: 'fewer prostaglandins', say: 'Paracetamol inhibits that enzyme in the central nervous system, so those substances drop.' },
              { icon: 'out', label: 'The result', detail: 'less pain, less fever', say: 'The result: pain eases and temperature comes down.' },
            ] },
          { type: 'compare', title: 'Why is it not an anti-inflammatory?', a: 'Paracetamol', b: 'Ibuprofen', say: 'A question that keeps coming up in exams: how does it differ from ibuprofen?',
            items: [
              { side: 'a', label: 'Acts centrally', detail: 'in the brain and spinal cord', say: 'Paracetamol works centrally.' },
              { side: 'b', label: 'Acts peripherally', detail: 'at the site of inflammation', say: 'Ibuprofen works at the site of inflammation itself.' },
              { side: 'a', label: 'Inflammation: weak', detail: 'not relied on for it', say: 'So paracetamol’s effect on inflammation is weak.' },
              { side: 'b', label: 'Inflammation: clear', detail: 'one of the NSAIDs', say: 'And ibuprofen is a clear anti-inflammatory.' },
            ] },
        ],
        quiz: [{ q: 'Where does paracetamol mainly act?', options: ['At the site of inflammation', 'In the central nervous system', 'In the stomach'], answer: 1, why: 'It inhibits COX centrally, which is why its anti-inflammatory effect is weak.' }],
        tf: [{ s: 'Paracetamol is a strong anti-inflammatory like ibuprofen.', answer: false, why: 'Its anti-inflammatory effect is weak.' }, { s: 'Paracetamol reduces prostaglandin production centrally.', answer: true, why: 'That underlies its pain relief and fever reduction.' }] },
      { title: 'Pharmacokinetics and safety', takeaway: 'Safe at the right dose; an overdose endangers the liver',
        scenes: [
          { type: 'line', title: 'Drug level in the blood after one dose', unit: 'level', approx: true, say: 'After you take the dose, its level in the blood rises and then falls.',
            items: [
              { label: 'Start', value: 0, say: 'We start from zero.' },
              { label: '30 min', value: 70, say: 'It rises quickly.' },
              { label: '1 hour', value: 100, say: 'It peaks at about half an hour to an hour.' },
              { label: '3 hours', value: 50, say: 'Then it halves roughly every two to three hours. That is the half-life.' },
              { label: '6 hours', value: 20, say: 'Which is why the dose is repeated every four to six hours.' },
            ] },
          { type: 'pie', title: 'Where does it go in the liver?', unit: 'metabolism', approx: true, say: 'The liver handles it, and most of it leaves by a safe route.',
            items: [
              { label: 'Safe conjugation', value: 90, say: 'Most of it is bound to substances that let it leave safely in the urine.' },
              { label: 'Toxic NAPQI route', value: 7, say: 'A small part becomes a toxic substance called NAPQI, which glutathione neutralises.' },
              { label: 'Leaves unchanged', value: 3, say: 'And a little leaves as it is.' },
            ] },
          { type: 'table', title: 'Normal dose versus overdose', cols: ['Therapeutic dose', 'Overdose'], say: 'The difference between a therapeutic dose and an overdose is the whole story.',
            items: [
              { label: 'NAPQI', cells: ['a small amount', 'a large amount'], say: 'In an overdose the toxic substance increases.' },
              { label: 'Glutathione', cells: ['enough to neutralise it', 'runs out'], say: 'Glutathione is used up and cannot neutralise it.' },
              { label: 'The liver', cells: ['healthy', 'at risk of damage'], say: 'So liver cells are damaged.' },
              { label: 'Treatment', cells: ['none needed', 'N-acetylcysteine'], say: 'The antidote is N-acetylcysteine, which replenishes glutathione.' },
            ] },
        ],
        quiz: [{ q: 'Why does an overdose harm the liver?', options: ['The drug builds up in the stomach', 'NAPQI rises and glutathione runs out', 'The kidneys stop working'], answer: 1, why: 'The toxic substance exceeds what glutathione can neutralise.' }],
        tf: [{ s: 'Most paracetamol is metabolised in the liver by safe routes.', answer: true, why: 'Conjugation is the main route.' }, { s: 'The antidote for paracetamol poisoning is N-acetylcysteine.', answer: true, why: 'It replenishes glutathione.' }, { s: 'NAPQI is completely safe.', answer: false, why: 'It is the toxic metabolite, neutralised by glutathione.' }] },
    ],
  };

  const MATH = {
    id: 'demo-math', name: 'Maths example: The Quadratic Equation',
    slides: [
      { title: 'The quadratic formula', bullets: ['General form: ax² + bx + c = 0', 'Discriminant Δ = b² − 4ac', 'Solution: x = (−b ± √Δ) / 2a'] },
      { title: 'Worked example: x² − 5x + 6 = 0', bullets: ['Identify a, b and c', 'Compute the discriminant', 'Find the two roots'] },
    ],
    lessons: [
      { title: 'The quadratic formula', takeaway: 'Compute the discriminant first: it tells you how many solutions there are',
        scenes: [
          { type: 'big', title: 'The general form', text: 'ax² + bx + c = 0', note: 'Any equation with x squared can be written this way', say: 'Any quadratic equation, whatever it looks like, can be arranged in this form: a x squared, plus b x, plus c, equals zero.' },
          { type: 'formula', title: 'The formula', say: 'And solving it follows one fixed formula.',
            items: [
              { label: 'Δ = b² − 4ac', detail: 'discriminant', say: 'First we compute the discriminant, delta: b squared minus four a c.' },
              { label: 'x = (−b ± √Δ) / 2a', detail: 'solution', say: 'Then the solution: minus b, plus or minus the root of delta, over two a.' },
            ] },
          { type: 'pyramid', title: 'The discriminant sets the number of solutions', say: 'And the discriminant tells you how many solutions you will find.',
            items: [
              { label: 'Δ > 0', detail: 'two different solutions', say: 'If it is positive, you have two different solutions.' },
              { label: 'Δ = 0', detail: 'one repeated solution', say: 'If it is zero, one repeated solution.' },
              { label: 'Δ < 0', detail: 'no real solution', say: 'And if it is negative, there is no real solution.' },
            ] },
        ],
        quiz: [{ q: 'If the discriminant is negative, how many real solutions are there?', options: ['Two', 'One', 'None'], answer: 2, why: 'A negative number has no real square root.' }],
        tf: [{ s: 'The discriminant equals b² − 4ac.', answer: true, why: 'That is its definition.' }, { s: 'If the discriminant is zero the equation has two different solutions.', answer: false, why: 'It has one repeated solution.' }] },
      { title: 'Worked example: x² − 5x + 6 = 0', takeaway: 'The solutions: x = 2 and x = 3',
        scenes: [
          { type: 'formula', title: 'Solve it step by step', say: 'Let us apply the formula to a real equation: x squared minus five x plus six equals zero.',
            items: [
              { label: 'a = 1 ,  b = −5 ,  c = 6', detail: 'coefficients', say: 'Step one, identify the coefficients: a is one, b is minus five, and c is six.' },
              { label: 'Δ = (−5)² − 4(1)(6)', detail: 'substitute', say: 'Substitute into the discriminant.' },
              { label: 'Δ = 25 − 24 = 1', detail: 'positive: two roots', say: 'Twenty-five minus twenty-four is one. Positive, so two solutions.' },
              { label: 'x = (5 ± 1) / 2', detail: 'into the formula', say: 'Substitute into the formula: five plus or minus one, over two.' },
              { label: 'x = 3   ,   x = 2', detail: 'answer', say: 'So the solutions are three and two.' },
            ] },
          { type: 'line', title: 'The same solution on a graph', unit: 'y', say: 'If we plot the function, the solutions are where the curve touches the x axis.',
            items: [
              { label: 'x = 0', value: 6, say: 'At zero the value is six.' },
              { label: '1', value: 2, say: 'It drops to two.' },
              { label: '2', value: 0, say: 'At two it touches zero. That is the first solution.' },
              { label: '3', value: 0, say: 'At three it touches zero again. That is the second.' },
              { label: '4', value: 2, say: 'Then it climbs back.' },
              { label: '5', value: 6, say: 'In the same symmetric shape.' },
            ] },
          { type: 'list', title: 'Check your answer', say: 'And finally, always check.',
            items: [
              { icon: 'check', label: 'Substitute x = 2', detail: '4 − 10 + 6 = 0', say: 'Put in two: four minus ten plus six is zero. Correct.' },
              { icon: 'check', label: 'Substitute x = 3', detail: '9 − 15 + 6 = 0', say: 'Put in three: nine minus fifteen plus six is zero. Correct.' },
              { icon: 'warn', label: 'Common mistake', detail: 'forgetting that b is negative', say: 'Watch for the classic mistake: forgetting that b is negative, so minus b becomes plus five.' },
            ] },
        ],
        quiz: [{ q: 'In x² − 5x + 6 = 0, what is −b?', options: ['−5', '5', '6'], answer: 1, why: 'b = −5, so −b = 5.' }],
        tf: [{ s: 'The solutions of x² − 5x + 6 = 0 are 2 and 3.', answer: true, why: 'Substituting either gives zero.' }, { s: 'The discriminant of this equation is 49.', answer: false, why: 'It is 25 − 24 = 1.' }] },
    ],
  };
  return [CS, PHARMA, MATH];
});
