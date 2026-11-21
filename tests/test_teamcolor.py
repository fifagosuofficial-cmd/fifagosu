"""공식 팀컬러 목록 파서와 이상 응답 보호 테스트."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "crawler"))
import teamcolor  # noqa: E402


class TeamColorTests(unittest.TestCase):
    def test_parse_teamcolor_rows_and_merge_tiers(self):
        html = """<table><tbody>
      <tr data-type="club"><td>3</td><td>FC 바르셀로나</td><td>1단계</td><td>전체 능력치 +1 짧은 패스 +2</td></tr>
      <tr data-type="club"><td>6</td><td>FC 바르셀로나</td><td>2단계</td><td>전체 능력치 +2 드리블 +3</td></tr>
      <tr data-type="nation"><td>8</td><td>대한민국</td><td>3단계</td><td>전체 능력치 +3 크로스 +2</td></tr>
    </tbody></table>"""
        rows = teamcolor.parse_teamcolors(html)
        barca = next(x for x in rows if x["name"] == "FC 바르셀로나")
        self.assertEqual(barca["type"], "club")
        self.assertEqual(barca["maxLevel"], 2)
        self.assertEqual(barca["requiredCounts"], [3, 6])
        self.assertEqual(barca["effects"][0]["stats"], {"all": 1, "shortpassing": 2})
        self.assertEqual(barca["effects"][1]["requiredCount"], 6)
        korea = next(x for x in rows if x["name"] == "대한민국")
        self.assertEqual(korea["type"], "nation")
        self.assertEqual(korea["effects"][0]["stats"]["crossing"], 2)

    def test_collect_rejects_drop_and_keeps_previous_file(self):
        # 50건 최소 기준을 만족하는 응답이지만 기존 목록보다 급감하므로 저장하면 안 돼요.
        rows = "".join(
            f'<tr data-type="club"><td>3</td><td>팀 {i}</td><td>1단계</td><td>속력 +1</td></tr>'
            for i in range(50)
        )
        with tempfile.TemporaryDirectory() as td:
            tmp_path = Path(td)
            path = tmp_path / "teamcolor" / "teamcolors.json"
            path.parent.mkdir()
            path.write_text('{"items":[{}]}', encoding="utf-8")

            class Client:
                def get(self, *args, **kwargs):
                    return f"<table>{rows}</table>"

            # Existing count 100 triggers the 25% decline guard.
            previous = {"items": [{}] * 100}
            with self.assertRaisesRegex(ValueError, "급감"):
                teamcolor.collect(Client(), tmp_path, previous)
            self.assertEqual(path.read_text("utf-8"), '{"items":[{}]}')


if __name__ == "__main__":
    unittest.main()
