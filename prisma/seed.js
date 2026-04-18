const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const seedQuestions = [
  {
    question: "What is the capital of Finland?",
    answer: "Helsinki",
  },
  {
    question: "Which continent is Brazil located in?",
    answer: "South America",
  },
  {
    question: "What is the largest ocean on Earth?",
    answer: "Pacific Ocean",
  },
  {
    question: "Which country has the city of Tokyo as its capital?",
    answer: "Japan",
  },
  {
    question: "What river flows through Egypt?",
    answer: "The Nile",
  },
  {
    question: "Which desert is the largest hot desert in the world?",
    answer: "The Sahara",
  },
];

async function main() {
  await prisma.question.deleteMany();

  for (const item of seedQuestions) {
    await prisma.question.create({
      data: {
        question: item.question,
        answer: item.answer,
      },
    });
  }

  console.log("Seed data inserted successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());