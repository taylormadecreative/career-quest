import { pythonString } from "./first-run-rules.js";

// Quest 1.1 is lesson data. Python output, not these choices, determines a pass.
export const FIRST_RUN = {
  id: "1.1",
  title: "First Run",
  goal: "Make Python show your name for your portfolio.",
  // This is only the student's first run, never the alternate check inputs.
  displayCode: (personal) => `PROFILE_NAME = ${pythonString(String(personal ?? "").trim())}\nprint(____)`,
  explain: [
    "Python is a language for giving a computer instructions. The print instruction shows a message in the output area.",
    "A string is text inside quotation marks. For example, print(\"Hello!\") shows Hello! without the quotation marks.",
    "The first line stores the name you enter under PROFILE_NAME. In the second line, choose what print should show.",
  ],
  prediction: {
    prompt: 'What will print("Hello!") show?',
    choices: [
      { id: "word", label: "Hello!", feedback: "Yes. Python shows the text inside the quotation marks." },
      { id: "quotes", label: '"Hello!"', feedback: "Try again. The quotation marks tell Python where the text begins and ends; print does not show them." },
      { id: "error", label: "An error", feedback: "Try again. The text has matching quotation marks and is inside the parentheses, so Python can show it." },
    ],
  },
  move: {
    instructions: "Type your name. The game puts it into PROFILE_NAME for you. Choose what goes in the blank so print shows the name PROFILE_NAME holds.",
    choices: [
      { id: "literal", code: '"PROFILE_NAME"', feedback: "Quotation marks make this the literal letters PROFILE_NAME, not the name you typed." },
      { id: "name", code: "PROFILE_NAME", feedback: "Run it to see what Python shows." },
      { id: "empty", code: '""', feedback: "An empty pair of quotation marks is empty text; it cannot show your name." },
    ],
  },
  hints: [
    { tier: "Observe", text: "Look at the output. Does it show your name, or does it show other letters or an empty line?" },
    { tier: "Reason", text: "Quotation marks make words into literal text. A name without quotes can refer to text that was saved for you." },
    { tier: "Practice", text: 'Try a different example: fruit = "pear". In print("fruit"), the quotes make Python show the letters fruit. Think about what changes when a saved name is used without quotes.' },
  ],
  why: "Python read the text saved as PROFILE_NAME and print showed that text. The result came from the name you entered.",
  interview: "In a guided exercise, I used Python to show an input and checked that the instruction worked when the input changed.",
};

export function predictionFeedback(id) {
  const choice = FIRST_RUN.prediction.choices.find((c) => c.id === id);
  return choice ? { correct: id === "word", message: choice.feedback } : { correct: false, message: "Choose one of the three answers." };
}
