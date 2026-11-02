from config import GO_THRESHOLD, CONDITIONAL_THRESHOLD, ABORT_THRESHOLD


REASON_TEXT = {
    "battery": "battery degradation",
    "motor": "motor overheating",
    "wind": "wind exceeding rating",
    "vibration": "excessive vibration",
    "none": "no significant risk",
}


def decide_launch(drone_id, viability_result):
    """
    Given a drone's viability result (from run_viability), decide whether
    to launch it as-is, try a reroute, or hold it back (NO-GO).
    """
    s_end = viability_result["sEnd"]
    risk = viability_result["dominantRisk"]
    reason_text = REASON_TEXT.get(risk, risk)

    if s_end >= GO_THRESHOLD:
        decision = "GO"
    elif s_end >= CONDITIONAL_THRESHOLD:
        decision = "REROUTE"
    else:
        decision = "NO-GO"

    return {
        "drone_id": drone_id,
        "decision": decision,
        "sEnd": s_end,
        "dominantRisk": risk,
        "reason": f"{drone_id} {decision}: survival {round(s_end*100)}%, {reason_text}",
    }


def check_abort(drone_id, s_continue, s_return, consecutive_bad_checks):
    """
    Called roughly once per second during flight. Decides whether to abort.
    Requires 2 consecutive bad checks in a row so a single noisy reading
    doesn't cause the drone to flicker between states.

    Returns (should_abort: bool, new_consecutive_count: int, reason: str)
    """
    is_bad = (s_continue < s_return) or (s_continue < ABORT_THRESHOLD)

    if is_bad:
        consecutive_bad_checks += 1
    else:
        consecutive_bad_checks = 0

    should_abort = consecutive_bad_checks >= 2

    if should_abort:
        reason = (f"{drone_id} ABORT: continuing survival {round(s_continue*100)}% "
                  f"vs returning {round(s_return*100)}%")
    else:
        reason = f"{drone_id} continuing: survival {round(s_continue*100)}%"

    return should_abort, consecutive_bad_checks, reason


def select_handoff(idle_drones_viability, mission_value=1.0, travel_time_weight=0.01):
    """
    Given a dict of {drone_id: (sEnd, travel_time)} for idle spare drones,
    picks the best one to send as a replacement.

    Returns (best_drone_id, score) or (None, None) if no drones available.
    """
    if not idle_drones_viability:
        return None, None

    best_id = None
    best_score = float("-inf")
    for drone_id, (s_end, travel_time) in idle_drones_viability.items():
        score = s_end * mission_value - travel_time_weight * travel_time
        if score > best_score:
            best_score = score
            best_id = drone_id

    return best_id, round(best_score, 3)


class BaselineController:
    """Simple SoC-threshold controller, used for comparison against the
    joint viability approach in the evaluation/demo."""

    @staticmethod
    def decide_launch(drone_id, current_soc):
        if current_soc > 30:
            return {"drone_id": drone_id, "decision": "GO",
                    "reason": f"{drone_id} GO: SoC {current_soc}% > 30%"}
        else:
            return {"drone_id": drone_id, "decision": "NO-GO",
                    "reason": f"{drone_id} NO-GO: SoC {current_soc}% too low"}

    @staticmethod
    def check_abort(drone_id, current_soc):
        should_abort = current_soc < 20
        reason = f"{drone_id} ABORT: SoC critical ({current_soc}%)" if should_abort \
            else f"{drone_id} continuing: SoC {current_soc}%"
        return should_abort, reason