const Address = require('../models/Address');
const Shop = require('../models/Shop');
const { geocodeAddress } = require('../services/googleMaps.service');

async function createAddress(req, res, next) {
  try {
    const { label, addressLine, landmark, city, state, pincode, dropOffInstructions, isDefault } = req.body;

    const fullAddressText = `${addressLine}, ${landmark || ''}, ${city}, ${state} ${pincode}, India`;

    let geo = { lat: null, lng: null };
    let geocodeStatus = 'pending';
    try {
      geo = await geocodeAddress(fullAddressText);
      geocodeStatus = 'ok';
    } catch (geoErr) {
      // We still save the address even if geocoding fails — it can be retried later.
      geocodeStatus = 'failed';
      console.warn('[Geocode] failed for new address:', geoErr.message);
    }

    const address = await Address.create({
      shop: req.shop._id,
      label,
      addressLine,
      landmark,
      city,
      state,
      pincode,
      dropOffInstructions,
      isDefault: !!isDefault,
      geocodeStatus,
      location: {
        type: 'Point',
        coordinates: [geo.lng || 0, geo.lat || 0],
      },
    });

    if (isDefault) {
      await Shop.findByIdAndUpdate(req.shop._id, { defaultAddress: address._id });
    }

    res.status(201).json({ success: true, address });
  } catch (err) {
    next(err);
  }
}

async function listAddresses(req, res, next) {
  try {
    const addresses = await Address.find({ shop: req.shop._id }).sort({ isDefault: -1, createdAt: -1 });
    res.json({ success: true, addresses });
  } catch (err) {
    next(err);
  }
}

async function updateAddress(req, res, next) {
  try {
    const address = await Address.findOne({ _id: req.params.id, shop: req.shop._id });
    if (!address) return res.status(404).json({ success: false, message: 'Address not found.' });

    const fields = ['label', 'addressLine', 'landmark', 'city', 'state', 'pincode', 'dropOffInstructions', 'isDefault'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) address[f] = req.body[f];
    });

    // Re-geocode if the physical address text changed
    if (['addressLine', 'landmark', 'city', 'state', 'pincode'].some((f) => req.body[f] !== undefined)) {
      try {
        const fullAddressText = `${address.addressLine}, ${address.landmark || ''}, ${address.city}, ${address.state} ${address.pincode}, India`;
        const geo = await geocodeAddress(fullAddressText);
        address.location.coordinates = [geo.lng, geo.lat];
        address.geocodeStatus = 'ok';
      } catch (geoErr) {
        address.geocodeStatus = 'failed';
      }
    }

    await address.save();

    if (address.isDefault) {
      await Shop.findByIdAndUpdate(req.shop._id, { defaultAddress: address._id });
    }

    res.json({ success: true, address });
  } catch (err) {
    next(err);
  }
}

async function deleteAddress(req, res, next) {
  try {
    const address = await Address.findOneAndDelete({ _id: req.params.id, shop: req.shop._id });
    if (!address) return res.status(404).json({ success: false, message: 'Address not found.' });
    res.json({ success: true, message: 'Address deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { createAddress, listAddresses, updateAddress, deleteAddress };
