from collections import defaultdict

_subscribers = defaultdict(list)


def subscribe(topic, fn):
    """Register a function to be called whenever a message is published to this topic."""
    _subscribers[topic].append(fn)


def publish(topic, msg):
    """Send a message to every function subscribed to this topic."""
    for fn in _subscribers[topic]:
        fn(msg)


def clear():
    """Useful for resetting between test runs."""
    _subscribers.clear()