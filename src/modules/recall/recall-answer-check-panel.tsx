import { useAppTranslation } from "../language";
import {
  getRecallAnswerCheckConfidenceTranslationKey,
  getRecallAnswerCheckReasonTranslationKey,
  getRecallAnswerCheckStatusTranslationKey,
  getRecallRatingTranslationKey,
} from "./learner-copy";
import type { RecallAnswerCheckResult } from "./recall-answer-check";

type RecallAnswerCheckPanelProps = {
  answerCheck: RecallAnswerCheckResult;
  showAlgorithmVersion: boolean;
};

type RecallAnswerCheckTermsProps = {
  heading: string;
  keyPrefix: string;
  terms: readonly string[];
};

export function RecallAnswerCheckPanel({
  answerCheck,
  showAlgorithmVersion,
}: RecallAnswerCheckPanelProps) {
  const { t } = useAppTranslation();
  const { evidence } = answerCheck;
  const detectedContradictions = (evidence.detectedContradictions ?? []).map(
    (contradiction) =>
      `${contradiction.referenceText} -> ${contradiction.answerText}`,
  );
  const contradictedConcepts = (evidence.contradictedConcepts ?? []).map(
    (concept) => concept.text,
  );
  const coveredConcepts = (evidence.coveredConcepts ?? []).map(
    (concept) => concept.text,
  );
  const matchedProhibitedPhrases = (
    evidence.matchedProhibitedPhrases ?? []
  ).map((match) => match.text);
  const partialConcepts = (evidence.partialConcepts ?? []).map(
    (concept) => concept.text,
  );
  const missingConcepts = (evidence.missingConcepts ?? []).map(
    (concept) => concept.text,
  );
  const hasConceptCoverage =
    answerCheck.matchedAcceptedVariant === undefined &&
    (coveredConcepts.length > 0 ||
      partialConcepts.length > 0 ||
      missingConcepts.length > 0);
  const notDetectedExpectedTerms = evidence.notDetectedExpectedTerms ?? [];
  const unmatchedExpectedTerms =
    notDetectedExpectedTerms.length > 0
      ? {
          heading: t("recall.answerCheck.notDetectedTerms"),
          keyPrefix: "not-detected",
          terms: notDetectedExpectedTerms,
        }
      : {
          heading: t("recall.answerCheck.missingTerms"),
          keyPrefix: "missing",
          terms: evidence.missingExpectedTerms,
        };
  const hasContradictions =
    detectedContradictions.length > 0 ||
    contradictedConcepts.length > 0 ||
    matchedProhibitedPhrases.length > 0;

  return (
    <section
      aria-label={t("recall.answerCheck.title")}
      className="recall-answer-check"
      data-status={answerCheck.status}
    >
      <div className="recall-answer-check__header">
        <div>
          <p className="recall-answer-check__eyebrow">
            {t("recall.answerCheck.title")}
          </p>
          <h5>
            {t(getRecallAnswerCheckStatusTranslationKey(answerCheck.status))}
          </h5>
        </div>
        <span className="recall-answer-check__confidence">
          {t(
            getRecallAnswerCheckConfidenceTranslationKey(
              answerCheck.confidence,
            ),
          )}
        </span>
      </div>
      <p className="recall-answer-check__caption">
        {t("recall.answerCheck.caption")}
      </p>
      {showAlgorithmVersion ? (
        <p className="recall-answer-check__caption">
          <strong>{t("recall.answerCheck.algorithmVersion")}</strong>{" "}
          <span>{answerCheck.algorithmVersion}</span>
        </p>
      ) : null}
      <p className="recall-card__body recall-answer-check__summary">
        {t(getRecallAnswerCheckReasonTranslationKey(answerCheck.primaryReason))}
      </p>
      {hasContradictions ? (
        <>
          <RecallAnswerCheckTerms
            heading={t("recall.answerCheck.detectedContradictions")}
            keyPrefix="detected-contradiction"
            terms={detectedContradictions}
          />
          <RecallAnswerCheckTerms
            heading={t("recall.answerCheck.contradictedConcepts")}
            keyPrefix="contradicted-concept"
            terms={contradictedConcepts}
          />
          <RecallAnswerCheckTerms
            heading={t("recall.answerCheck.matchedProhibitedPhrases")}
            keyPrefix="matched-prohibited"
            terms={matchedProhibitedPhrases}
          />
        </>
      ) : null}
      {answerCheck.matchedAcceptedVariant !== undefined ? (
        <div className="recall-answer-check__matched-variant">
          <h6>{t("recall.answerCheck.matchedAcceptedVariant")}</h6>
          <p className="recall-card__body">
            {answerCheck.matchedAcceptedVariant.text}
          </p>
        </div>
      ) : null}
      <p className="recall-answer-check__suggested-rating">
        <strong>{t("recall.answerCheck.suggestedSelfRating")}</strong>
        <span>
          {t(getRecallRatingTranslationKey(answerCheck.suggestedSelfRating))}
        </span>
      </p>
      {hasConceptCoverage ? (
        <>
          <RecallAnswerCheckTerms
            heading={t("recall.answerCheck.coveredConcepts")}
            keyPrefix="covered-concept"
            terms={coveredConcepts}
          />
          <RecallAnswerCheckTerms
            heading={t("recall.answerCheck.partialConcepts")}
            keyPrefix="partial-concept"
            terms={partialConcepts}
          />
          <RecallAnswerCheckTerms
            heading={t("recall.answerCheck.missingConcepts")}
            keyPrefix="missing-concept"
            terms={missingConcepts}
          />
        </>
      ) : (
        <>
          <RecallAnswerCheckTerms
            heading={t("recall.answerCheck.matchedTerms")}
            keyPrefix="matched"
            terms={evidence.matchedExpectedTerms}
          />
          <RecallAnswerCheckTerms
            heading={unmatchedExpectedTerms.heading}
            keyPrefix={unmatchedExpectedTerms.keyPrefix}
            terms={unmatchedExpectedTerms.terms}
          />
        </>
      )}
    </section>
  );
}

function RecallAnswerCheckTerms({
  heading,
  keyPrefix,
  terms,
}: RecallAnswerCheckTermsProps) {
  if (terms.length === 0) {
    return null;
  }

  return (
    <div className="recall-answer-check__terms">
      <h6>{heading}</h6>
      <ul>
        {terms.slice(0, 4).map((term) => (
          <li key={`${keyPrefix}-${term}`}>{term}</li>
        ))}
      </ul>
    </div>
  );
}
