import { Router } from 'express';
import TokenLog from '../models/TokenLog.js';

const router = Router();

router.get('/', async (req, res) => {
  const logs = await TokenLog.find().sort({ createdAt: -1 }).limit(25);
  res.json(logs);
});

router.post('/', async (req, res) => {
  const log = await TokenLog.create({
    event: req.body.event,
    status: req.body.status,
    message: req.body.message,
    payload: req.body.payload,
  });

  res.status(201).json(log);
});

export default router;