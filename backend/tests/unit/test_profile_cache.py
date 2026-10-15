"""build_profile caches per registry: repeat calls are served from memory, and the result is identical."""
from app.domain import profile


def test_repeat_profile_is_cached_and_identical(monkeypatch):
    calls=[]
    sentinel=[object()]

    def fake_compute(registry, vector, view):
        calls.append(view)
        return sentinel

    class Registry:
        pass

    class Vector:
        def __init__(self, age):
            self.age=age

        def model_dump(self, mode):
            return {"age": self.age}

    monkeypatch.setattr(profile, "_compute", fake_compute)
    registry=Registry()
    first=profile.build_profile(registry, Vector(50))  # type: ignore[arg-type]
    second=profile.build_profile(registry, Vector(50))  # type: ignore[arg-type]
    other=profile.build_profile(registry, Vector(51))  # type: ignore[arg-type]
    assert first==second==other==sentinel and len(calls)==2
    assert profile.build_profile(Registry(), Vector(50))==sentinel and len(calls)==3  # type: ignore[arg-type]
