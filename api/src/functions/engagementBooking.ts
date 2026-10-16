import { app } from '@azure/functions';
import { createEngagementBookingHandler } from '../booking/engagementBookingHandler.js';

app.http('engagementBookings', {
  methods: ['GET', 'POST'], authLevel: 'anonymous', route: 'engagementBookings',
  handler: createEngagementBookingHandler(),
});
