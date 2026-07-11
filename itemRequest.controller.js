const ItemRequest = require('../models/ItemRequest');

async function createRequest(req, res, next) {
  try {
    const { itemName, brand, quantityNeeded, notes } = req.body;
    const request = await ItemRequest.create({
      shop: req.shop._id,
      itemName,
      brand,
      quantityNeeded,
      notes,
    });

    const io = req.app.get('io');
    io.to('ops_team').emit('itemRequest:new', { request });

    res.status(201).json({ success: true, request });
  } catch (err) {
    next(err);
  }
}

async function listRequests(req, res, next) {
  try {
    const requests = await ItemRequest.find({ shop: req.shop._id }).sort({ createdAt: -1 });
    res.json({ success: true, requests });
  } catch (err) {
    next(err);
  }
}

/** Ops-side: quote or fulfil a request, notifies the shop in real time */
async function respondToRequest(req, res, next) {
  try {
    const { status, quotedPricePerPack } = req.body;
    const request = await ItemRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });

    request.status = status;
    if (quotedPricePerPack) request.quotedPricePerPack = quotedPricePerPack;
    request.respondedAt = new Date();
    await request.save();

    const io = req.app.get('io');
    io.to(`shop_${request.shop}`).emit('itemRequest:updated', { request });

    res.json({ success: true, request });
  } catch (err) {
    next(err);
  }
}

module.exports = { createRequest, listRequests, respondToRequest };
