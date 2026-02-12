import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // 1. Read input
  const body = await request.json();
  const userInput = body.userInput || body.message;

  // 2. Fake delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 3. Fake Response Structure (Matches your original Claude code)
  const mockParsed = {
    reflection: "I notice you're testing the system interface.",
    question: "This is a mock response. Your UI should now be able to see this text. What would you like to test next?",
    action: "Add Anthropic credits to enable real AI logic."
  };

  // 4. Return it exactly how your frontend expects it
  return NextResponse.json({
    sessionId: "mock-session-123",
    response: mockParsed, // Sending the full object, not just a string
    usage: { cost: 0 }
  });
}