const mongoose = require('mongoose');

/**
 * Address is stored with a GeoJSON Point + a 2dsphere index so we can:
 *  - geocode once on save (via Google Maps Geocoding API, see services/googleMaps.service.js)
 *  - run $near / $geoWithin queries (e.g. "which warehouse hub is closest to this shop")
 *  - feed lat/lng straight into Directions / Distance Matrix calls for ETA + navigation
 */
const addressSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    label: { type: String, default: 'Shop address' }, // e.g. "Main counter", "Godown"
    addressLine: { type: String, required: true },
    landmark: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },

    // GeoJSON — coordinates are [lng, lat], per Mongo/GeoJSON convention
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },

    dropOffInstructions: {
      type: String,
      default: 'Hand over to counter staff. No need to close the shop.',
    },
    isDefault: { type: Boolean, default: false },
    geocodeStatus: {
      type: String,
      enum: ['pending', 'ok', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

addressSchema.index({ location: '2dsphere' });

addressSchema.virtual('lat').get(function () {
  return this.location?.coordinates?.[1];
});
addressSchema.virtual('lng').get(function () {
  return this.location?.coordinates?.[0];
});
addressSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Address', addressSchema);
