"""
Attribute system for idols in Idol Producer game.

Each idol has attributes across four major categories:
1. Physical: strength, agility, natural fitness, stamina
2. Appearance: cute, pretty
3. Technical: pitch, tone, breath, rhythm, power, grace
4. Mental: clever, humor, talking, determination, teamwork, fashion

Plus hidden attributes (not visible to player):
- professionalism, injury proneness, ambition, loyalty
"""

from dataclasses import dataclass
from typing import Dict
import random

# Import translations (with fallback if not available)
try:
    from translations import get_attribute_chinese, get_category_chinese
except ImportError:
    # Fallback if translations module not available
    def get_attribute_chinese(attr: str) -> str:
        return attr
    def get_category_chinese(cat: str) -> str:
        return cat


@dataclass
class PhysicalAttributes:
    """Physical attributes affecting stamina, endurance, and physical performance."""
    strength: int = 0          # Physical power and muscle strength
    agility: int = 0           # Speed, flexibility, and coordination
    natural_fitness: int = 0   # Base physical condition and health
    stamina: int = 0           # Endurance for long performances
    
    def __post_init__(self):
        """Ensure attributes are within valid range (0-20)."""
        self.strength = max(0, min(20, self.strength))
        self.agility = max(0, min(20, self.agility))
        self.natural_fitness = max(0, min(20, self.natural_fitness))
        self.stamina = max(0, min(20, self.stamina))
    
    def to_dict(self) -> Dict[str, int]:
        """Convert to dictionary."""
        return {
            'strength': self.strength,
            'agility': self.agility,
            'natural_fitness': self.natural_fitness,
            'stamina': self.stamina
        }
    
    def to_dict_chinese(self) -> Dict[str, int]:
        """Convert to dictionary with Chinese keys."""
        return {
            get_attribute_chinese('strength'): self.strength,
            get_attribute_chinese('agility'): self.agility,
            get_attribute_chinese('natural_fitness'): self.natural_fitness,
            get_attribute_chinese('stamina'): self.stamina
        }
    
    @classmethod
    def random(cls, min_val: int = 1, max_val: int = 20) -> 'PhysicalAttributes':
        """Generate random physical attributes."""
        return cls(
            strength=random.randint(min_val, max_val),
            agility=random.randint(min_val, max_val),
            natural_fitness=random.randint(min_val, max_val),
            stamina=random.randint(min_val, max_val)
        )


@dataclass
class AppearanceAttributes:
    """Appearance attributes affecting visual appeal and marketability."""
    cute: int = 0      # Kawaii factor, youthful charm
    pretty: int = 0  # Classical beauty, elegance
    
    def __post_init__(self):
        """Ensure attributes are within valid range (0-20)."""
        self.cute = max(0, min(20, self.cute))
        self.pretty = max(0, min(20, self.pretty))
    
    def to_dict(self) -> Dict[str, int]:
        """Convert to dictionary."""
        return {
            'cute': self.cute,
            'pretty': self.pretty
        }
    
    def to_dict_chinese(self) -> Dict[str, int]:
        """Convert to dictionary with Chinese keys."""
        return {
            get_attribute_chinese('cute'): self.cute,
            get_attribute_chinese('pretty'): self.pretty
        }
    
    @classmethod
    def random(cls, min_val: int = 1, max_val: int = 20) -> 'AppearanceAttributes':
        """Generate random appearance attributes."""
        return cls(
            cute=random.randint(min_val, max_val),
            pretty=random.randint(min_val, max_val)
        )


@dataclass
class TechnicalAttributes:
    """Technical attributes affecting performance skills."""
    pitch: int = 0      # Vocal pitch accuracy
    tone: int = 0       # Vocal tone quality
    breath: int = 0     # Breath control and vocal stamina
    rhythm: int = 0     # Rhythm and timing
    power: int = 0      # Vocal/dance power and intensity
    grace: int = 0      # Movement grace and fluidity
    
    def __post_init__(self):
        """Ensure attributes are within valid range (0-20)."""
        self.pitch = max(0, min(20, self.pitch))
        self.tone = max(0, min(20, self.tone))
        self.breath = max(0, min(20, self.breath))
        self.rhythm = max(0, min(20, self.rhythm))
        self.power = max(0, min(20, self.power))
        self.grace = max(0, min(20, self.grace))
    
    def to_dict(self) -> Dict[str, int]:
        """Convert to dictionary."""
        return {
            'pitch': self.pitch,
            'tone': self.tone,
            'breath': self.breath,
            'rhythm': self.rhythm,
            'power': self.power,
            'grace': self.grace
        }
    
    def to_dict_chinese(self) -> Dict[str, int]:
        """Convert to dictionary with Chinese keys."""
        return {
            get_attribute_chinese('pitch'): self.pitch,
            get_attribute_chinese('tone'): self.tone,
            get_attribute_chinese('breath'): self.breath,
            get_attribute_chinese('rhythm'): self.rhythm,
            get_attribute_chinese('power'): self.power,
            get_attribute_chinese('grace'): self.grace
        }
    
    @classmethod
    def random(cls, min_val: int = 1, max_val: int = 20) -> 'TechnicalAttributes':
        """Generate random technical attributes."""
        return cls(
            pitch=random.randint(min_val, max_val),
            tone=random.randint(min_val, max_val),
            breath=random.randint(min_val, max_val),
            rhythm=random.randint(min_val, max_val),
            power=random.randint(min_val, max_val),
            grace=random.randint(min_val, max_val)
        )


@dataclass
class MentalAttributes:
    """Mental attributes affecting personality, communication, and teamwork."""
    clever: int = 0         # Intelligence and quick thinking
    humor: int = 0          # Sense of humor and entertainment value
    talking: int = 0        # Communication and conversation skills
    determination: int = 0  # Willpower and persistence
    teamwork: int = 0       # Ability to work with others
    fashion: int = 0        # Fashion sense and style awareness
    
    def __post_init__(self):
        """Ensure attributes are within valid range (0-20)."""
        self.clever = max(0, min(20, self.clever))
        self.humor = max(0, min(20, self.humor))
        self.talking = max(0, min(20, self.talking))
        self.determination = max(0, min(20, self.determination))
        self.teamwork = max(0, min(20, self.teamwork))
        self.fashion = max(0, min(20, self.fashion))
    
    def to_dict(self) -> Dict[str, int]:
        """Convert to dictionary."""
        return {
            'clever': self.clever,
            'humor': self.humor,
            'talking': self.talking,
            'determination': self.determination,
            'teamwork': self.teamwork,
            'fashion': self.fashion
        }
    
    def to_dict_chinese(self) -> Dict[str, int]:
        """Convert to dictionary with Chinese keys."""
        return {
            get_attribute_chinese('clever'): self.clever,
            get_attribute_chinese('humor'): self.humor,
            get_attribute_chinese('talking'): self.talking,
            get_attribute_chinese('determination'): self.determination,
            get_attribute_chinese('teamwork'): self.teamwork,
            get_attribute_chinese('fashion'): self.fashion
        }
    
    @classmethod
    def random(cls, min_val: int = 1, max_val: int = 20) -> 'MentalAttributes':
        """Generate random mental attributes."""
        return cls(
            clever=random.randint(min_val, max_val),
            humor=random.randint(min_val, max_val),
            talking=random.randint(min_val, max_val),
            determination=random.randint(min_val, max_val),
            teamwork=random.randint(min_val, max_val),
            fashion=random.randint(min_val, max_val)
        )


@dataclass
class HiddenAttributes:
    """
    Hidden attributes not visible to the player.
    These affect behavior, training, and group dynamics behind the scenes.
    """
    professionalism: int = 0      # Work ethic and dedication
    injury_proneness: int = 0     # Likelihood of getting injured (lower is better)
    ambition: int = 0             # Career ambition and drive
    loyalty: int = 0              # Loyalty to the group and company
    
    def __post_init__(self):
        """Ensure attributes are within valid range (0-20)."""
        self.professionalism = max(0, min(20, self.professionalism))
        self.injury_proneness = max(0, min(20, self.injury_proneness))
        self.ambition = max(0, min(20, self.ambition))
        self.loyalty = max(0, min(20, self.loyalty))
    
    def to_dict(self) -> Dict[str, int]:
        """Convert to dictionary (for internal use only)."""
        return {
            'professionalism': self.professionalism,
            'injury_proneness': self.injury_proneness,
            'ambition': self.ambition,
            'loyalty': self.loyalty
        }
    
    def to_dict_chinese(self) -> Dict[str, int]:
        """Convert to dictionary with Chinese keys (for internal use only)."""
        return {
            get_attribute_chinese('professionalism'): self.professionalism,
            get_attribute_chinese('injury_proneness'): self.injury_proneness,
            get_attribute_chinese('ambition'): self.ambition,
            get_attribute_chinese('loyalty'): self.loyalty
        }
    
    @classmethod
    def random(cls, min_val: int = 1, max_val: int = 20) -> 'HiddenAttributes':
        """Generate random hidden attributes."""
        return cls(
            professionalism=random.randint(min_val, max_val),
            injury_proneness=random.randint(min_val, max_val),
            ambition=random.randint(min_val, max_val),
            loyalty=random.randint(min_val, max_val)
        )


@dataclass
class IdolAttributes:
    """
    Complete attribute template for an idol.
    Combines all four major attribute categories plus hidden attributes.
    """
    physical: PhysicalAttributes
    appearance: AppearanceAttributes
    technical: TechnicalAttributes
    mental: MentalAttributes
    hidden: HiddenAttributes
    
    def __post_init__(self):
        """Initialize with default values if None provided."""
        if self.physical is None:
            self.physical = PhysicalAttributes()
        if self.appearance is None:
            self.appearance = AppearanceAttributes()
        if self.technical is None:
            self.technical = TechnicalAttributes()
        if self.mental is None:
            self.mental = MentalAttributes()
        if self.hidden is None:
            self.hidden = HiddenAttributes()
    
    def to_dict(self, include_hidden: bool = False) -> Dict:
        """
        Convert to dictionary.
        
        Args:
            include_hidden: If True, includes hidden attributes (for debugging/admin)
        
        Returns:
            Dictionary containing all visible attributes, optionally hidden ones
        """
        result = {
            'physical': self.physical.to_dict(),
            'appearance': self.appearance.to_dict(),
            'technical': self.technical.to_dict(),
            'mental': self.mental.to_dict()
        }
        if include_hidden:
            result['hidden'] = self.hidden.to_dict()
        return result
    
    def to_dict_chinese(self, include_hidden: bool = False) -> Dict:
        """
        Convert to dictionary with Chinese keys.
        
        Args:
            include_hidden: If True, includes hidden attributes (for debugging/admin)
        
        Returns:
            Dictionary containing all visible attributes with Chinese keys, optionally hidden ones
        """
        result = {
            get_category_chinese('physical'): self.physical.to_dict_chinese(),
            get_category_chinese('appearance'): self.appearance.to_dict_chinese(),
            get_category_chinese('technical'): self.technical.to_dict_chinese(),
            get_category_chinese('mental'): self.mental.to_dict_chinese()
        }
        if include_hidden:
            result[get_category_chinese('hidden')] = self.hidden.to_dict_chinese()
        return result
    
    def get_overall_rating(self) -> float:
        """
        Calculate overall rating based on all visible attributes.
        
        Returns:
            Average of all visible attributes (0-20)
        """
        physical_avg = sum(self.physical.to_dict().values()) / 4
        appearance_avg = sum(self.appearance.to_dict().values()) / 2
        technical_avg = sum(self.technical.to_dict().values()) / 6
        mental_avg = sum(self.mental.to_dict().values()) / 6
        
        # Weighted average (can be adjusted based on game balance)
        return (physical_avg * 0.15 + 
                appearance_avg * 0.20 + 
                technical_avg * 0.40 + 
                mental_avg * 0.25)
    
    def get_ability(self) -> int:
        """
        Calculate ability rating using the official formula:
        ROUNDDOWN(SUM(physical)/16*3 + MAX(cute,pretty) + MIN(cute,pretty)/4 + 
                  SUM(technical)/3 + SUM(mental_except_fashion)/6)
        
        Formula breakdown:
        - Physical: (strength + agility + natural_fitness + stamina) / 16 * 3
        - Appearance: MAX(cute, pretty) + MIN(cute, pretty) / 4
        - Technical: (pitch + tone + breath + rhythm + power + grace) / 3
        - Mental: (clever + humor + talking + determination + teamwork) / 6
        - Note: fashion is excluded from mental sum
        
        Returns:
            Ability rating as integer (rounded down)
        """
        import math
        
        # Physical: SUM(strength, agility, natural_fitness, stamina) / 16 * 3
        physical_sum = (self.physical.strength + 
                       self.physical.agility + 
                       self.physical.natural_fitness + 
                       self.physical.stamina)
        physical_part = (physical_sum / 16) * 3
        
        # Appearance: MAX(cute, pretty) + MIN(cute, pretty) / 4
        appearance_max = max(self.appearance.cute, self.appearance.pretty)
        appearance_min = min(self.appearance.cute, self.appearance.pretty)
        appearance_part = appearance_max + (appearance_min / 4)
        
        # Technical: SUM(pitch, tone, breath, rhythm, power, grace) / 3
        technical_sum = (self.technical.pitch + 
                        self.technical.tone + 
                        self.technical.breath + 
                        self.technical.rhythm + 
                        self.technical.power + 
                        self.technical.grace)
        technical_part = technical_sum / 3
        
        # Mental: SUM(clever, humor, talking, determination, teamwork) / 6
        # Note: fashion is excluded from the sum
        mental_sum = (self.mental.clever + 
                     self.mental.humor + 
                     self.mental.talking + 
                     self.mental.determination + 
                     self.mental.teamwork +
                     self.mental.fashion)
        mental_part = mental_sum / 6
        
        # Sum all parts and round down
        total_ability = physical_part + appearance_part + technical_part + mental_part
        return math.floor(total_ability)
    
    @classmethod
    def random(cls, min_val: int = 1, max_val: int = 20) -> 'IdolAttributes':
        """Generate random attributes for a new idol."""
        return cls(
            physical=PhysicalAttributes.random(min_val, max_val),
            appearance=AppearanceAttributes.random(min_val, max_val),
            technical=TechnicalAttributes.random(min_val, max_val),
            mental=MentalAttributes.random(min_val, max_val),
            hidden=HiddenAttributes.random(min_val, max_val)
        )
    
    @classmethod
    def default(cls) -> 'IdolAttributes':
        """Generate default attributes for a new idol.
        
        All attributes set to 12, except injury_proneness which is set to 4.
        """
        return cls(
            physical=PhysicalAttributes(
                strength=12,
                agility=12,
                natural_fitness=12,
                stamina=12
            ),
            appearance=AppearanceAttributes(
                cute=12,
                pretty=12
            ),
            technical=TechnicalAttributes(
                pitch=12,
                tone=12,
                breath=12,
                rhythm=12,
                power=12,
                grace=12
            ),
            mental=MentalAttributes(
                clever=12,
                humor=12,
                talking=12,
                determination=12,
                teamwork=12,
                fashion=12
            ),
            hidden=HiddenAttributes(
                professionalism=12,
                injury_proneness=4,  # Lower is better for injury proneness
                ambition=12,
                loyalty=12
            )
        )
    
    @classmethod
    def create_from_dict(cls, data: Dict, include_hidden: bool = False) -> 'IdolAttributes':
        """Create IdolAttributes from a dictionary."""
        physical = PhysicalAttributes(**data.get('physical', {}))
        appearance = AppearanceAttributes(**data.get('appearance', {}))
        technical = TechnicalAttributes(**data.get('technical', {}))
        mental = MentalAttributes(**data.get('mental', {}))
        
        hidden_data = data.get('hidden', {}) if include_hidden else {}
        hidden = HiddenAttributes(**hidden_data) if hidden_data else HiddenAttributes()
        
        return cls(
            physical=physical,
            appearance=appearance,
            technical=technical,
            mental=mental,
            hidden=hidden
        )


# Example usage
if __name__ == "__main__":
    # Create a random idol with attributes
    idol_attrs = IdolAttributes.random(min_val=1, max_val=20)
    
    print("=== Idol Attributes Template ===")
    print(f"\nPhysical Attributes:")
    print(f"  Strength: {idol_attrs.physical.strength}")
    print(f"  Agility: {idol_attrs.physical.agility}")
    print(f"  Natural Fitness: {idol_attrs.physical.natural_fitness}")
    print(f"  Stamina: {idol_attrs.physical.stamina}")
    
    print(f"\nAppearance Attributes:")
    print(f"  Cute: {idol_attrs.appearance.cute}")
    print(f"  Pretty: {idol_attrs.appearance.pretty}")
    
    print(f"\nTechnical Attributes:")
    print(f"  Pitch: {idol_attrs.technical.pitch}")
    print(f"  Tone: {idol_attrs.technical.tone}")
    print(f"  Breath: {idol_attrs.technical.breath}")
    print(f"  Rhythm: {idol_attrs.technical.rhythm}")
    print(f"  Power: {idol_attrs.technical.power}")
    print(f"  Grace: {idol_attrs.technical.grace}")
    
    print(f"\nMental Attributes:")
    print(f"  Clever: {idol_attrs.mental.clever}")
    print(f"  Humor: {idol_attrs.mental.humor}")
    print(f"  Talking: {idol_attrs.mental.talking}")
    print(f"  Determination: {idol_attrs.mental.determination}")
    print(f"  Teamwork: {idol_attrs.mental.teamwork}")
    print(f"  Fashion: {idol_attrs.mental.fashion}")
    
    print(f"\nHidden Attributes (for debugging):")
    print(f"  Professionalism: {idol_attrs.hidden.professionalism}")
    print(f"  Injury Proneness: {idol_attrs.hidden.injury_proneness}")
    print(f"  Ambition: {idol_attrs.hidden.ambition}")
    print(f"  Loyalty: {idol_attrs.hidden.loyalty}")
    
    print(f"\nOverall Rating: {idol_attrs.get_overall_rating():.1f}/20")
    print(f"Ability: {idol_attrs.get_ability()}")
    
    print(f"\n=== Dictionary Representation (Visible Only) ===")
    print(idol_attrs.to_dict(include_hidden=False))

