import { Kafka } from 'kafkajs';

const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'my-app',
    brokers: (process.env.KAFKA_BROKERS || 'redpanda:9092').split(','),
});

export function createProducer() {
    return kafka.producer();
}

export function createConsumer({ topic, groupId, handler }) {
    const consumer = kafka.consumer({ groupId });

    return {
        consumer,
        async start() {
            await consumer.connect();
            await consumer.subscribe({ topic, fromBeginning: false });

            await consumer.run({
                autoCommit: false,
                partitionsConsumedConcurrently: 1,
                eachMessage: async ({ topic, partition, message }) => {
                    const rawValue = message.value?.toString() || '{}';
                    let payload;

                    try {
                        payload = JSON.parse(rawValue);
                    } catch (error) {
                        payload = { raw: rawValue };
                    }

                    try {
                        await handler(payload, { topic, partition, message });
                    } finally {
                        const nextOffset = (BigInt(message.offset) + 1n).toString();
                        await consumer.commitOffsets([
                            {
                                topic,
                                partition,
                                offset: nextOffset,
                            },
                        ]);
                    }
                },
            });

            return consumer;
        },
    };
}

export function parseKafkaMessage(message) {
    const rawValue = message?.value?.toString() || '{}';

    try {
        return JSON.parse(rawValue);
    } catch {
        return { raw: rawValue };
    }
}

export { kafka };