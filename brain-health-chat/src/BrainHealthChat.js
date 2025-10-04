import React, { useState, useEffect, useRef } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { MessageCircle, User, Brain, TrendingUp, Target, CheckCircle, ArrowRight, RotateCcw, Play } from 'lucide-react';

const BrainHealthChat = () => {
  const [currentSession, setCurrentSession] = useState(1);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [sessionProgress, setSessionProgress] = useState({});
  const [userProfile] = useState({
    name: 'Alex',
    age: 67,
    mciStage: 'Early',
    cognitiveAreas: ['memory', 'attention', 'executive_function'],
    personalGoals: ['independence', 'social_connection', 'mental_sharpness']
  });

  const messagesEndRef = useRef(null);

  // Sample data for cognitive tracking
  const [cognitiveData] = useState([
    { week: 'Week 1', memory: 65, attention: 70, executive: 60 },
    { week: 'Week 2', memory: 68, attention: 72, executive: 63 },
    { week: 'Week 3', memory: 72, attention: 75, executive: 67 },
    { week: 'Week 4', memory: 75, attention: 78, executive: 70 },
  ]);

  const sessionData = {
    1: {
      title: "Understanding Your Brain Health Journey",
      focus: "Introduction and Assessment",
      exercises: [
        "Memory recall exercise",
        "Attention span assessment",
        "Goal setting workshop"
      ],
      insights: "Your cognitive baseline shows strong potential for improvement through targeted exercises.",
      tips: [
        "Maintain a consistent sleep schedule",
        "Engage in daily physical activity",
        "Practice mindfulness meditation"
      ]
    },
    2: {
      title: "Memory Enhancement Strategies",
      focus: "Working Memory and Recall",
      exercises: [
        "Word association chains",
        "Visual-spatial memory games",
        "Story reconstruction exercises"
      ],
      insights: "Your visual memory shows particular strength - we can leverage this in daily activities.",
      tips: [
        "Use visualization techniques for remembering names",
        "Create mental maps of familiar routes",
        "Practice the 'memory palace' technique"
      ]
    },
    3: {
      title: "Attention and Focus Training",
      focus: "Sustained Attention and Concentration",
      exercises: [
        "Selective attention tasks",
        "Dual-task coordination",
        "Mindful breathing exercises"
      ],
      insights: "Your attention improves significantly with structured practice sessions.",
      tips: [
        "Minimize distractions during important tasks",
        "Use the Pomodoro Technique for work sessions",
        "Practice single-tasking instead of multitasking"
      ]
    },
    4: {
      title: "Executive Function Development",
      focus: "Planning and Decision Making",
      exercises: [
        "Problem-solving scenarios",
        "Planning and scheduling tasks",
        "Cognitive flexibility challenges"
      ],
      insights: "Your planning abilities strengthen when you break complex tasks into smaller steps.",
      tips: [
        "Use daily planners and checklists",
        "Practice decision-making with time limits",
        "Create backup plans for important activities"
      ]
    },
    5: {
      title: "Social Cognition and Communication",
      focus: "Interpersonal Skills and Language",
      exercises: [
        "Conversation practice scenarios",
        "Emotion recognition tasks",
        "Storytelling and narrative exercises"
      ],
      insights: "Your communication skills remain strong and can support other cognitive areas.",
      tips: [
        "Engage in regular social activities",
        "Practice active listening techniques",
        "Join discussion groups or book clubs"
      ]
    },
    6: {
      title: "Lifestyle Integration",
      focus: "Daily Habits and Routines",
      exercises: [
        "Habit formation exercises",
        "Stress management techniques",
        "Technology assistance training"
      ],
      insights: "Consistent daily routines can significantly support your cognitive health.",
      tips: [
        "Establish morning and evening routines",
        "Use technology reminders wisely",
        "Maintain social connections regularly"
      ]
    },
    7: {
      title: "Future Planning and Maintenance",
      focus: "Long-term Strategies and Support",
      exercises: [
        "Goal review and adjustment",
        "Support network mapping",
        "Cognitive maintenance planning"
      ],
      insights: "You've built a strong foundation for continued cognitive health.",
      tips: [
        "Schedule regular cognitive health check-ins",
        "Continue challenging mental activities",
        "Maintain the habits you've developed"
      ]
    }
  };

  const initializeSession = (sessionNum) => {
    const session = sessionData[sessionNum];
    const welcomeMessage = {
      id: Date.now(),
      type: 'ai',
      content: `Welcome to Session ${sessionNum}: ${session.title}

Today we'll focus on ${session.focus}. Based on your profile and progress, I've prepared personalized exercises and strategies that will help strengthen your cognitive abilities.

${session.insights}

Would you like to start with today's exercises, review your progress, or discuss any specific concerns?`,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages([welcomeMessage]);
  };

  // Load conversation state from localStorage
  useEffect(() => {
    const savedMessages = localStorage.getItem(`brainHealthMessages_${currentSession}`);
    const savedProgress = localStorage.getItem('brainHealthProgress');

    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    } else {
      // Initialize with welcome message for each session
      initializeSession(currentSession);
    }

    if (savedProgress) {
      setSessionProgress(JSON.parse(savedProgress));
    }
  }, [currentSession]);

  // Save conversation state
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`brainHealthMessages_${currentSession}`, JSON.stringify(messages));
    }
  }, [messages, currentSession]);

  useEffect(() => {
    localStorage.setItem('brainHealthProgress', JSON.stringify(sessionProgress));
  }, [sessionProgress]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputValue,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMessage]);

    // Generate AI response
    setTimeout(() => {
      const aiResponse = generateAIResponse(inputValue, currentSession);
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);

    setInputValue('');
  };

  const generateAIResponse = (userInput, sessionNum) => {
    const session = sessionData[sessionNum];
    const lowerInput = userInput.toLowerCase();

    let response = '';

    if (lowerInput.includes('exercise') || lowerInput.includes('activity')) {
      const exercise = session.exercises[Math.floor(Math.random() * session.exercises.length)];
      response = `Great choice! Let's try this exercise: "${exercise}"

For this activity, I want you to:
1. Find a quiet, comfortable space
2. Take three deep breaths to center yourself
3. Follow the instructions I'll provide step by step

This exercise is specifically designed for ${session.focus.toLowerCase()}. Are you ready to begin?`;
    } else if (lowerInput.includes('progress') || lowerInput.includes('improvement')) {
      response = `Your progress has been excellent! Here's what I've observed:

🧠 **Cognitive Strengths:** Your ${userProfile.cognitiveAreas.join(', ')} areas show consistent improvement
📈 **Session Performance:** You've completed ${Object.keys(sessionProgress).length} out of 7 sessions
🎯 **Personal Goals:** We're making great progress toward your goals of ${userProfile.personalGoals.join(', ')}

${session.insights}

Would you like to see your detailed progress charts or discuss specific areas where you'd like to focus more?`;
    } else if (lowerInput.includes('tip') || lowerInput.includes('advice') || lowerInput.includes('help')) {
      const tip = session.tips[Math.floor(Math.random() * session.tips.length)];
      response = `Here's a personalized tip for you:

💡 **${tip}**

This strategy is particularly effective for people in the ${userProfile.mciStage.toLowerCase()} stage of MCI. Many of my clients find that implementing this gradually, perhaps starting with just 10-15 minutes a day, makes it more sustainable.

Would you like me to help you create a specific plan for implementing this tip in your daily routine?`;
    } else if (lowerInput.includes('concerned') || lowerInput.includes('worried') || lowerInput.includes('difficulty')) {
      response = `I understand your concerns, ${userProfile.name}. It's completely normal to have worries about cognitive changes - it shows you're taking an active, positive approach to your brain health.

What you're experiencing is part of ${userProfile.mciStage.toLowerCase()} MCI, and the fact that you're here, engaging in these sessions, is already a powerful step forward. Research shows that people who actively work on cognitive training, like you're doing, often see significant improvements.

Remember:
- Your brain has remarkable plasticity at any age
- Small, consistent efforts create meaningful change
- You have support and strategies to help you succeed

Can you tell me more specifically what's been concerning you? I'd like to provide more targeted guidance.`;
    } else if (lowerInput.includes('family') || lowerInput.includes('support')) {
      response = `Family support is incredibly valuable in this journey! Here are some ways to involve your loved ones:

👥 **Communication Strategies:**
- Share what you're learning in these sessions
- Ask them to practice memory games with you
- Involve them in your daily cognitive exercises

🏠 **Home Environment:**
- Create consistent routines together
- Use family photos for memory exercises
- Practice conversations about shared experiences

💪 **Encouragement:**
- Celebrate small victories together
- Have them remind you of your progress
- Include them in goal-setting discussions

Would you like me to help you create a specific plan for talking with your family about your cognitive health journey?`;
    } else {
      // Default response
      response = `That's a thoughtful question, ${userProfile.name}. In ${session.title}, we focus on ${session.focus.toLowerCase()}.

${session.insights}

Here are some ways I can help you today:
- Guide you through cognitive exercises
- Review your progress and improvements
- Provide personalized tips and strategies
- Discuss any concerns or challenges you're facing
- Help you plan for continued success

What would be most helpful for you right now?`;
    }

    return {
      id: Date.now() + 1,
      type: 'ai',
      content: response,
      timestamp: new Date().toLocaleTimeString()
    };
  };

  const switchSession = (sessionNum) => {
    setCurrentSession(sessionNum);
    // Mark previous sessions as completed
    const newProgress = { ...sessionProgress };
    for (let i = 1; i < sessionNum; i++) {
      newProgress[i] = 'completed';
    }
    newProgress[sessionNum] = 'current';
    setSessionProgress(newProgress);
  };

  const resetSession = () => {
    setMessages([]);
    localStorage.removeItem(`brainHealthMessages_${currentSession}`);
    initializeSession(currentSession);
  };

  const startExercise = () => {
    const session = sessionData[currentSession];
    const exercise = session.exercises[0]; // Start with first exercise

    const exerciseMessage = {
      id: Date.now(),
      type: 'ai',
      content: `Let's begin with: ${exercise}

This exercise will help strengthen your ${session.focus.toLowerCase()}. I'll guide you through each step.

**Step 1:** Take a moment to get comfortable and focused.
**Step 2:** Clear your mind of distractions.
**Step 3:** When you're ready, let me know and we'll proceed with the specific exercise instructions.

Are you ready to begin?`,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, exerciseMessage]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Brain className="w-8 h-8 text-indigo-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Brain Health Companion</h1>
                <p className="text-gray-600">Personalized Cognitive Training for {userProfile.name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Session {currentSession} of 7</p>
              <p className="text-lg font-semibold text-indigo-600">{sessionData[currentSession].title}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Session Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2 text-indigo-600" />
                Sessions
              </h3>
              <div className="space-y-2">
                {Object.entries(sessionData).map(([num, session]) => (
                  <button
                    key={num}
                    onClick={() => switchSession(parseInt(num))}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      currentSession === parseInt(num)
                        ? 'bg-indigo-100 border-2 border-indigo-300'
                        : sessionProgress[num] === 'completed'
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Session {num}</span>
                      {sessionProgress[num] === 'completed' && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                      {currentSession === parseInt(num) && (
                        <Play className="w-4 h-4 text-indigo-600" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{session.title}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Progress Chart */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-indigo-600" />
                Progress
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={cognitiveData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="memory" stroke="#8884d8" strokeWidth={2} />
                  <Line type="monotone" dataKey="attention" stroke="#82ca9d" strokeWidth={2} />
                  <Line type="monotone" dataKey="executive" stroke="#ffc658" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-2 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>📊 Memory</span>
                  <span>🎯 Attention</span>
                  <span>⚡ Executive</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Interface */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-lg flex flex-col h-[600px]">
              {/* Chat Header */}
              <div className="border-b p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <MessageCircle className="w-6 h-6 text-indigo-600" />
                  <div>
                    <h3 className="text-lg font-semibold">{sessionData[currentSession].title}</h3>
                    <p className="text-sm text-gray-600">Focus: {sessionData[currentSession].focus}</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={startExercise}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
                  >
                    <Play className="w-4 h-4" />
                    <span>Start Exercise</span>
                  </button>
                  <button
                    onClick={resetSession}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.type === 'user'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {message.type === 'ai' && (
                          <Brain className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                        )}
                        {message.type === 'user' && (
                          <User className="w-5 h-5 text-white mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          <p className={`text-xs mt-1 ${
                            message.type === 'user' ? 'text-indigo-200' : 'text-gray-500'
                          }`}>
                            {message.timestamp}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t p-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask about exercises, progress, tips, or share your thoughts..."
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
                  >
                    <span>Send</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Session Info Panel */}
        <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Today's Session Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-medium text-gray-800 mb-2">📚 Today's Exercises</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {sessionData[currentSession].exercises.map((exercise, idx) => (
                  <li key={idx}>• {exercise}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 mb-2">💡 Key Insight</h4>
              <p className="text-sm text-gray-600">{sessionData[currentSession].insights}</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 mb-2">🎯 Tips for Success</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {sessionData[currentSession].tips.slice(0, 2).map((tip, idx) => (
                  <li key={idx}>• {tip}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrainHealthChat;