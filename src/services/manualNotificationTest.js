// Manual test for notification message generation
const { generateMorningMessage, generateEveningMessage } = require('./notificationMessages');

console.log('--- Manual Notification Message Test ---');

const userName = 'TestUser';
const morningCount = 5;
const eveningCount = 2;

console.log('Morning message:', generateMorningMessage(userName, morningCount));
console.log('Evening message:', generateEveningMessage(eveningCount));

// Try different values
console.log('Morning message (0 tasks):', generateMorningMessage(userName, 0));
console.log('Evening message (1 task):', generateEveningMessage(1));
