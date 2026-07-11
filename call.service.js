const twilio = require('twilio');

function client() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error('Twilio credentials are not set in the environment.');
  }
  return twilio(sid, token);
}

/**
 * Places a masked call: Twilio calls the shop owner first; once they pick up,
 * <Dial> bridges to the delivery partner. Neither party ever sees the other's
 * real phone number — only Bulk It's Twilio caller ID.
 *
 * Requires a small TwiML endpoint (see routes/call.routes.js -> /twiml/bridge)
 * that Twilio fetches to know who to dial next.
 */
async function initiateBridgedCall({ shopPhone, riderPhone, publicBaseUrl }) {
  const twimlUrl = `${publicBaseUrl}/api/calls/twiml/bridge?to=${encodeURIComponent(riderPhone)}`;

  const call = await client().calls.create({
    to: shopPhone,
    from: process.env.TWILIO_CALLER_ID,
    url: twimlUrl, // Twilio fetches TwiML instructions from here once the shop owner answers
  });

  return { callSid: call.sid, status: call.status };
}

/** TwiML response that dials the second leg (rider) once the first leg answers. */
function bridgeTwiml(toNumber) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();
  twiml.say('Connecting you to your Bulk It delivery partner.');
  const dial = twiml.dial({ callerId: process.env.TWILIO_CALLER_ID });
  dial.number(toNumber);
  return twiml.toString();
}

module.exports = { initiateBridgedCall, bridgeTwiml };
