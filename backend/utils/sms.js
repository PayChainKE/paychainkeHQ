/**
 * Utility for sending SMS notifications.
 * Currently uses a mock logger until a provider (e.g. Africa's Talking) is configured.
 */

export const sendSMS = async (phoneNumber, message) => {
  try {
    // In production, this is where we'd initialize the SMS API provider
    // const sms = africastalking({ apiKey: '...', username: '...' }).SMS;
    // await sms.send({ to: [phoneNumber], message });
    
    console.log('\n================== SMS NOTIFICATION ==================');
    console.log(`TO: ${phoneNumber}`);
    console.log(`MESSAGE: ${message}`);
    console.log('STATUS: Sent successfully (Mocked)');
    console.log('======================================================\n');
    
    return { success: true, message: 'SMS sent successfully' };
  } catch (error) {
    console.error('Failed to send SMS:', error);
    return { success: false, error: error.message };
  }
};
