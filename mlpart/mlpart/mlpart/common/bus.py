from fnmatch import fnmatch

_subs = []   # list of (pattern, function)

def subscribe(pattern, fn):
    _subs.append((pattern, fn))

def publish(topic, msg):
    for pattern, fn in _subs:
        if fnmatch(topic, pattern):
            fn(topic, msg)      # callbacks receive (topic, msg)
            