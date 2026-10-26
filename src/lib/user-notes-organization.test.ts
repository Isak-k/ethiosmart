import { describe, it, expect } from 'vitest';
import { organizeChapterNotesLocal, extractChapterTopics } from './shortnotes-organizer';
import { synthesizeSectionBlocks } from './chapter-resource-generator';

describe('User Organized Notes & Exclusions', () => {
  it('correctly organizes user notes adhering to author headings (markdown, numbers, and bold)', () => {
    const userNoteText = `
# Psychology Chapter 1: Introduction to Psychology

## 1. Definition and Scope of Psychology
Psychology is the scientific study of mind and behavior. It encompasses the biological influences, social pressures, and environmental factors that affect how people think, act, and feel.

**2. Historical Perspectives in Psychology**
Historically, psychology began as a branch of philosophy before becoming an independent empirical science in 1879 when Wilhelm Wundt established the first experimental laboratory in Leipzig, Germany.

3. Structuralism and Functionalism
Structuralism sought to break down conscious experience into its basic components using introspection. In contrast, functionalism focused on how mental and behavioral processes enable organisms to adapt and survive.
`;

    const organized = organizeChapterNotesLocal(userNoteText, {
      chapterTitle: 'Introduction to Psychology',
      subjectName: 'Psychology',
    });

    // Check title
    expect(organized.title).toContain('Introduction to Psychology');

    // Sections should preserve the author's 3 distinct topics
    expect(organized.sections.length).toBe(3);
    expect(organized.sections[0].title).toBe('Definition and Scope of Psychology');
    expect(organized.sections[1].title).toBe('Historical Perspectives in Psychology');
    expect(organized.sections[2].title).toBe('Structuralism and Functionalism');
  });

  it('detects all topic headings from author notes without skipping', () => {
    const rawContent = `
1. Definition of Psychology
2. Biological Bases of Behavior
3. Sensation and Perception
4. Learning Theories
5. Memory and Cognition
`;
    const detected = extractChapterTopics(rawContent);
    expect(detected.length).toBe(5);
    expect(detected[0].title).toContain('Definition of Psychology');
    expect(detected[4].title).toContain('Memory and Cognition');
  });

  it('never generates "General Governing Formula" or fake integrals for Psychology or non-math subjects', () => {
    const psychSection = {
      id: 'sec-1',
      title: 'Operant Conditioning Mechanisms',
      content: 'B.F. Skinner demonstrated that behaviors followed by positive reinforcement increase in probability, while behaviors followed by punishment or non-reinforcement decrease.',
      keyPoints: ['Reinforcement strengthens behavior', 'Punishment suppresses behavior'],
    };

    const blocks = synthesizeSectionBlocks(psychSection, 'psychology', 'Operant Conditioning');

    // Verify no formula card is generated
    const formulaBlock = blocks.find((b) => b.type === 'formula');
    expect(formulaBlock).toBeUndefined();

    // Verify no worked example card is generated for Psychology
    const exampleBlock = blocks.find((b) => b.type === 'example');
    expect(exampleBlock).toBeUndefined();

    // Verify none of the blocks have the title "General Governing Formula"
    blocks.forEach((b) => {
      expect(b.title).not.toContain('General Governing Formula');
      expect(b.title).not.toContain('Governing Dynamical Formulation');
    });
  });

  it('correctly organizes comprehensive textbook note without over-fragmentation or synthetic boilerplate', () => {
    const rawNote = `CHAPTER THREE: LEARNING AND THEORIES OF LEARNING
Organized Study Notes • Simple English • Examples • Exam Preparation

1. Chapter Overview
Learning is an important part of human life. Almost everything we do, such as speaking, reading, writing, driving, and solving problems, involves learning.

Psychologists study learning to understand how people acquire new knowledge, skills, habits, and behaviors.

Learning outcomes
After studying this chapter, you should be able to:
- Define learning and explain its characteristics.
- Describe the principles and factors that influence learning.
- Explain the major theories of learning.

2. Definition of Learning
Learning is a relatively permanent change in behavior that occurs as a result of experience or practice.

In simple English, learning means gaining knowledge or skills, or changing how you behave, because of experience or practice.

Example: A student practices solving mathematics problems every day. After several days, the student can solve the problems independently. This is learning.

2.1 Main features of the definition
1. Learning involves a change in behavior: A person may develop a new skill, habit, attitude, or way of responding.
2. The change is relatively permanent: Learning usually lasts for some time rather than disappearing immediately.
3. Learning comes from experience or practice: The change must result from learning experiences.

3. Characteristics of Learning
The chapter identifies major characteristics of learning.
Characteristic\tSimple explanation\tExample
Continuous\tLearning continues throughout life.\tAn adult learns a new language.
Pervasive\tLearning affects many areas of life.\tA person learns social, academic, and practical skills.
Active process\tLearners participate in the learning process.\tA student practices instead of only listening.

4. Principles of Learning
Principles of learning are guidelines that help explain the conditions under which learning can be more effective.
4.1 Readiness
People learn best when they are physically, mentally, and emotionally ready.
4.2 Exercise and practice
Repeated, meaningful practice helps learners remember information and develop skills.

5. Factors Influencing Learning
Several factors affect how easily and effectively a person learns.
5.1 Motivation
Motivation is the desire or reason that encourages someone to learn. Strong motivation often leads to greater effort.
5.2 Maturation
Maturation refers to natural physical and mental development.

6. Theories of Learning and Their Applications
A theory of learning is an explanation of how learning occurs.
6.1 Classical Conditioning (Ivan Pavlov)
Classical conditioning is a type of learning in which a previously neutral stimulus produces a response after pairing.
Key terms in Pavlov's experiment:
Term\tMeaning\tPavlov's example
Neutral stimulus (NS)\tA stimulus that initially does not produce the response.\tBell before learning
Unconditioned stimulus (UCS)\tA stimulus that naturally produces a response.\tFood
Conditioned stimulus (CS)\tA formerly neutral stimulus that produces a response.\tBell after learning

6.2 Operant Conditioning (B.F. Skinner)
Operant conditioning is learning through reinforcement and punishment.

7. Comparison of the Major Learning Theories
Theory\tKey Proponent\tCore Mechanism\tClassroom Application
Classical Conditioning\tIvan Pavlov\tAssociation between stimuli\tCreating positive classroom atmosphere
Operant Conditioning\tB.F. Skinner\tConsequences of behavior\tUsing praise and reinforcement

8. Quick Revision: Important Terms
Term\tDefinition
Learning\tA relatively permanent change in behavior resulting from experience.
Conditioning\tA basic form of learning involving association.
Reinforcement\tAny event that strengthens or increases the likelihood of a behavior.
`;

    const organized = organizeChapterNotesLocal(rawNote, {
      chapterTitle: 'Learning and Theories of Learning',
      subjectName: 'Psychology',
    });

    // 1. Title should be cleanly extracted without metadata or Section 1.1 artifact
    expect(organized.title).toContain('LEARNING AND THEORIES OF LEARNING');
    expect(organized.sections.map((s) => s.title)).not.toContain('THREE: LEARNING AND THEORIES OF LEARNING');

    // 2. Exactly 8 cohesive major topics, NOT 58 fragmented bullet slices!
    expect(organized.sections.length).toBe(8);
    expect(organized.sections[0].title).toBe('Chapter Overview');
    expect(organized.sections[1].title).toBe('Definition of Learning');
    expect(organized.sections[2].title).toBe('Characteristics of Learning');
    expect(organized.sections[3].title).toBe('Principles of Learning');
    expect(organized.sections[4].title).toBe('Factors Influencing Learning');
    expect(organized.sections[5].title).toBe('Theories of Learning and Their Applications');
    expect(organized.sections[6].title).toBe('Comparison of the Major Learning Theories');
    expect(organized.sections[7].title).toBe('Quick Revision: Important Terms');

    // 3. Tab-separated tables are parsed into interactive table blocks
    const charSec = organized.sections[2];
    const charTable = charSec.contentBlocks?.find((b) => b.type === 'table');
    expect(charTable).toBeDefined();
    expect(charTable?.tableData?.headers).toContain('Characteristic');

    const compareSec = organized.sections[6];
    const compareTable = compareSec.contentBlocks?.find((b) => b.type === 'table');
    expect(compareTable).toBeDefined();
    expect(compareTable?.tableData?.headers).toContain('Theory');

    // 4. Zero robotic boilerplate (no CER model, no fake CS boilerplate)
    organized.sections.forEach((s) => {
      s.contentBlocks?.forEach((b) => {
        expect(b.content).not.toContain('In practice,');
        expect(b.content).not.toContain('targeted functions without requiring unnecessary manual overhead');
        expect(b.content).not.toContain('Claim-Evidence-Reasoning (CER)');
        expect(b.content).not.toContain('The primary foundational concept and analytical framework established in this section');
      });
    });

    // 5. extractChapterTopics also extracts exactly 8 topics
    const extracted = extractChapterTopics(rawNote);
    expect(extracted.length).toBe(8);
    expect(extracted[0].title).toBe('Chapter Overview');
    expect(extracted[7].title).toBe('Quick Revision: Important Terms');
  });
});
